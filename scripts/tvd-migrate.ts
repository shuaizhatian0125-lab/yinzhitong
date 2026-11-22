#!/usr/bin/env tsx
/**
 * TVD 数据库命令行入口。
 *
 *   pnpm tvd:status    当前后端、已应用迁移、表数量
 *   pnpm tvd:migrate   应用待执行迁移
 *   pnpm tvd:rollback  回滚最近一个迁移（PRD 要求迁移可逆，这条命令就是验收口）
 *
 * 未配 DATABASE_URL 时走 PGlite 文件库（.runtime/pglite/tvd），
 * 配了则连真实 PostgreSQL，两者共用同一套 SQL 与执行器。
 */
import { countTvdTables, discoverMigrations, migrate, planMigrations, rollback } from '../src/storage/database/tvd/migrator';

const cmd = process.argv[2] ?? 'status';

async function status(): Promise<void> {
  const plan = await planMigrations();
  const handle = await (await import('../src/storage/database/tvd/client')).getTvdDb();
  const files = discoverMigrations();
  const tables = await countTvdTables(handle);

  console.log(`后端        : ${handle.kind} (${handle.location})`);
  console.log(`迁移文件    : ${files.length} 个`);
  console.log(`已应用      : ${plan.applied.length > 0 ? plan.applied.join(', ') : '(无)'}`);
  console.log(`待应用      : ${plan.pending.length > 0 ? plan.pending.map((f) => f.name).join(', ') : '(无)'}`);
  console.log(`校验和漂移  : ${plan.drift.length > 0 ? plan.drift.join(', ') : '(无)'}`);
  console.log(`业务表数量  : ${tables}`);

  await handle.close();
}

async function main(): Promise<void> {
  switch (cmd) {
    case 'migrate': {
      const r = await migrate();
      console.log(`[tvd] 后端 ${r.kind} @ ${r.location}`);
      console.log(`[tvd] 应用迁移 ${r.applied.length} 个：${r.applied.join(', ') || '(已是最新)'}`);
      console.log(`[tvd] 业务表数量 ${r.tableCount}`);
      break;
    }
    case 'rollback': {
      const r = await rollback(undefined, process.argv[3]);
      console.log(r.rolledBack ? `[tvd] 已回滚 ${r.rolledBack}` : '[tvd] 没有可回滚的迁移');
      const handle = await (await import('../src/storage/database/tvd/client')).getTvdDb();
      console.log(`[tvd] 回滚后业务表数量 ${await countTvdTables(handle)}`);
      await handle.close();
      break;
    }
    case 'status':
      await status();
      break;
    default:
      console.error(`未知命令：${cmd}（可用：status | migrate | rollback）`);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[tvd] 失败：', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
