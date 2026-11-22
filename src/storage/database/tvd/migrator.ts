import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getTvdDb, type TvdDb } from './client';

/**
 * TVD 迁移执行器。
 *
 * 三条硬规则，都来自 PRD 的工程验收：
 *  1. 没有 .down.sql 的迁移拒绝执行 —— "可回滚"不能只是文档承诺。
 *  2. 已应用的迁移文件被改动过（checksum 不符）直接报错，不静默跳过。
 *     静默跳过会让本地库结构与版本库内容不一致，而这种不一致只在运行时炸。
 *  3. 每个迁移在单连接事务内执行，失败即整体回滚，不留半套表。
 */

const JOURNAL_DDL = `
CREATE TABLE IF NOT EXISTS "tvd_schema_migrations" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "checksum" text NOT NULL,
  "applied_at" timestamptz NOT NULL DEFAULT now()
);`;

export type TvdMigrationFile = {
  name: string;
  upSql: string;
  downSql: string;
  checksum: string;
};

export type TvdMigrationPlan = {
  pending: TvdMigrationFile[];
  applied: string[];
  drift: string[];
};

type JournalRow = { name: string; checksum: string };

function migrationsDir(): string {
  return resolve(process.env.TVD_MIGRATIONS_DIR ?? join(process.cwd(), 'db', 'tvd'));
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function discoverMigrations(): TvdMigrationFile[] {
  const dir = migrationsDir();
  if (!existsSync(dir)) {
    throw new Error(`[tvd:migrate] 迁移目录不存在：${dir}（先运行 node scripts/tvd-gen-migration.mjs）`);
  }

  const files = readdirSync(dir);
  const upFiles = files.filter((f) => f.endsWith('.up.sql')).sort();

  return upFiles.map((upName) => {
    const name = upName.replace(/\.up\.sql$/, '');
    const downName = `${name}.down.sql`;
    if (!files.includes(downName)) {
      throw new Error(`[tvd:migrate] ${upName} 缺少对应的 ${downName}，PRD 要求迁移可回滚`);
    }
    const upSql = readFileSync(join(dir, upName), 'utf8');
    const downSql = readFileSync(join(dir, downName), 'utf8');
    return { name, upSql, downSql, checksum: sha256(upSql) };
  });
}

export async function ensureJournal(handle: TvdDb): Promise<void> {
  await handle.exec(JOURNAL_DDL);
}

async function readApplied(handle: TvdDb): Promise<JournalRow[]> {
  return handle.query<JournalRow>('SELECT name, checksum FROM tvd_schema_migrations ORDER BY id');
}

export async function planMigrations(handle?: TvdDb): Promise<TvdMigrationPlan> {
  const h = handle ?? (await getTvdDb());
  await ensureJournal(h);

  const files = discoverMigrations();
  const appliedRows = await readApplied(h);
  const appliedMap = new Map(appliedRows.map((r) => [r.name, r.checksum]));

  const drift = files
    .filter((f) => appliedMap.has(f.name) && appliedMap.get(f.name) !== f.checksum)
    .map((f) => f.name);

  return {
    pending: files.filter((f) => !appliedMap.has(f.name)),
    applied: appliedRows.map((r) => r.name),
    drift,
  };
}

export async function migrate(handle?: TvdDb): Promise<{
  applied: string[];
  kind: TvdDb['kind'];
  location: string;
  tableCount: number;
}> {
  const h = handle ?? (await getTvdDb());
  const p = await planMigrations(h);

  if (p.drift.length > 0) {
    throw new Error(
      `[tvd:migrate] 以下已应用的迁移文件在应用后被修改：${p.drift.join(', ')}。\n` +
        '本地库结构与版本库已不一致。请回滚后重放，或删除 .runtime/pglite/tvd 重新初始化。',
    );
  }

  for (const file of p.pending) {
    await h.inTransaction(async (tx) => {
      await tx.exec(file.upSql);
      await tx.query('INSERT INTO tvd_schema_migrations (name, checksum) VALUES ($1, $2)', [
        file.name,
        file.checksum,
      ]);
    });
  }

  return {
    applied: p.pending.map((f) => f.name),
    kind: h.kind,
    location: h.location,
    tableCount: await countTvdTables(h),
  };
}

/** 回滚最近一个（或指定）迁移。 */
export async function rollback(handle?: TvdDb, targetName?: string): Promise<{ rolledBack: string | null }> {
  const h = handle ?? (await getTvdDb());
  await ensureJournal(h);

  const applied = await readApplied(h);
  if (applied.length === 0) return { rolledBack: null };

  const target = targetName ?? applied[applied.length - 1].name;
  const file = discoverMigrations().find((f) => f.name === target);
  if (!file) throw new Error(`[tvd:migrate] 找不到迁移 ${target} 的文件，无法回滚`);

  await h.inTransaction(async (tx) => {
    await tx.exec(file.downSql);
    await tx.query('DELETE FROM tvd_schema_migrations WHERE name = $1', [target]);
  });

  return { rolledBack: target };
}

/** 供健康检查使用：当前库上实际存在的 TVD 业务表数量（不含迁移日志表）。 */
export async function countTvdTables(handle?: TvdDb): Promise<number> {
  const h = handle ?? (await getTvdDb());
  const rows = await h.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'tvd!_%' ESCAPE '!'
        AND table_name <> 'tvd_schema_migrations'`,
  );
  return rows[0] ? Number(rows[0].count) : 0;
}
