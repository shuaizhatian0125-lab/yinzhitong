#!/usr/bin/env tsx
/**
 * 演示语料装载入口。
 *
 *   pnpm tvd:seed          写入（先清后写，可反复执行）
 *   pnpm tvd:seed --check  只数库里的行数，不写
 *
 * 迁移没跑过时先跑 tvd:migrate —— 这里不隐式建表，
 * 免得 seed 顺带把 schema 改了，出问题时说不清是谁动的。
 */
import { seedTvdDemo } from '../src/server/modules/tvd-data/seed';
import { countTvdRows } from '../src/server/modules/tvd-data/stats';
import { getTvdDb } from '../src/storage/database/tvd/client';

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'seed';
  // PGlite 会挂住事件循环；不 close 就永远不退出，管道里的输出也永远不刷新，
  // 看起来像"卡死"，其实只是进程不肯结束。
  const handle = await getTvdDb();
  try {
    if (cmd === '--check' || cmd === 'check') {
      const rows = await countTvdRows(handle);
      console.table(rows);
      return;
    }

    const t0 = Date.now();
    const summary = await seedTvdDemo(handle);
    console.log(`[tvd] 演示语料写入完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s（后端 ${handle.kind}）`);
    console.log(`  企业        ${summary.enterprises}`);
    console.log(`  专利        ${summary.patents}`);
    console.log(`  信号        ${summary.signals}`);
    console.log(`  证据        ${summary.evidence}`);
    console.log(`  结论绑定    ${summary.conclusionLinks}`);
    console.log(`  发明人关联  ${summary.inventorLinks}`);
    console.log(`  来源记录    ${summary.sourceRecords}`);
    console.log(`  赛道        ${summary.tracks}`);
    console.log(`  人物        ${summary.people}`);
    console.log(`  分级行数    ${JSON.stringify(summary.byDataKind)}`);
  } finally {
    await handle.close();
  }
}

main().catch((err) => {
  console.error('[tvd] seed 失败：', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
