#!/usr/bin/env node
/**
 * 由 Drizzle schema 生成 TVD 迁移的 up / down SQL。
 *
 * 不手写 DDL：38 张表的建表语句手写必然与 schema.ts 漂移，
 * 而漂移只有在运行时才暴露。drizzle-kit export 不需要数据库连接，
 * 因此这条链路在 CI 和本机都能跑。
 *
 * down 由 up 反推：先按逆序 DROP TABLE CASCADE（索引与约束随表消失），
 * 再逆序 DROP TYPE。CASCADE 在这里是安全的 —— 被删对象全部在 TVD 命名空间内。
 *
 * 用法：node scripts/tvd-gen-migration.mjs [序号] [名称]
 *      node scripts/tvd-gen-migration.mjs 0002 patent_grant_metrics
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(repoRoot, 'db', 'tvd');
// 必须用正斜杠：drizzle-kit 按 / 切分路径判断扩展名，Windows 的 \ 会让它报
// "please make sure to use .ts or other extension in the path"。
const schemaPath = 'src/storage/database/tvd/index.ts';

const seq = process.argv[2] ?? '0001';
const name = process.argv[3] ?? 'tvd_init';

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const ddl = execFileSync(
  process.execPath,
  [join('node_modules', 'drizzle-kit', 'bin.cjs'), 'export', `--schema=./${schemaPath}`, '--dialect=postgresql'],
  { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);

if (!ddl.includes('CREATE TABLE')) {
  console.error('[tvd-gen] export produced no CREATE TABLE statements');
  console.error(ddl.slice(0, 2000));
  process.exit(1);
}

const tableRe = /^CREATE TABLE "(?:public"\.)?"?([a-z_0-9]+)"?\s*\(/gm;
const typeRe = /^CREATE TYPE "(?:public"\.)?"?([a-z_0-9]+)"?/gm;

/** 只处理 tvd_ 前缀对象 —— 万一 export 带进 legacy 表，也不允许出现在 TVD 迁移里。 */
const tables = [...ddl.matchAll(tableRe)].map((m) => m[1]).filter((t) => t.startsWith('tvd_'));
const types = [...ddl.matchAll(typeRe)].map((m) => m[1]).filter((t) => t.startsWith('tvd_'));

const foreignKeyLines = ddl.split('\n').filter((l) => l.startsWith('ALTER TABLE') && l.includes('FOREIGN KEY'));
const restLines = ddl.split('\n').filter(
  (l) => l.startsWith('CREATE INDEX') || l.startsWith('CREATE UNIQUE INDEX'),
);

const header = [
  '-- TVD 迁移 ' + seq + '_' + name + ' —— 由 scripts/tvd-gen-migration.mjs 生成，请勿手改。',
  '-- 改表请编辑 src/storage/database/tvd/*.ts 后重新生成。',
  '-- 对象统计：' + tables.length + ' 张表 / ' + types.length + ' 个枚举 / ' + foreignKeyLines.length + ' 个外键 / ' + restLines.length + ' 个索引。',
  '',
].join('\n');

const up = [
  header,
  '-- ===== 枚举类型 =====',
  ddl.split('\n').filter((l) => l.startsWith('CREATE TYPE')).join('\n'),
  '',
  '-- ===== 表 =====',
  ddl
    .split('\n')
    .filter((l) => !l.startsWith('CREATE TYPE') && !l.startsWith('ALTER TABLE') && !l.startsWith('CREATE INDEX') && !l.startsWith('CREATE UNIQUE INDEX'))
    .join('\n')
    .trim(),
  '',
  '-- ===== 外键 =====',
  foreignKeyLines.join('\n'),
  '',
  '-- ===== 索引 =====',
  restLines.join('\n'),
  '',
].join('\n');

const down = [
  '-- TVD 迁移 ' + seq + '_' + name + ' 回滚 —— 由 scripts/tvd-gen-migration.mjs 生成，请勿手改。',
  '-- 顺序与 up 相反；CASCADE 仅作用于 tvd_* 对象。',
  '',
  ...tables.slice().reverse().map((t) => `DROP TABLE IF EXISTS "${t}" CASCADE;`),
  '',
  ...types.slice().reverse().map((t) => `DROP TYPE IF EXISTS "${t}";`),
  '',
].join('\n');

const upPath = join(outDir, `${seq}_${name}.up.sql`);
const downPath = join(outDir, `${seq}_${name}.down.sql`);
writeFileSync(upPath, up, 'utf8');
writeFileSync(downPath, down, 'utf8');

// 清掉早期版本留下的中间产物，避免迁移目录出现孤儿文件。
const raw = join(outDir, '0001_tvd_init.raw.sql');
if (existsSync(raw)) rmSync(raw);

const existing = readdirSync(outDir).filter((f) => f.endsWith('.up.sql'));
console.log(`[tvd-gen] wrote ${seq}_${name}.up.sql (${tables.length} tables)`);
console.log(`[tvd-gen] db/tvd 现有迁移：${existing.sort().join(', ')}`);
