import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { QueryResultRow } from 'pg';
import { tvdSchema } from './index';

type TvdSchema = typeof tvdSchema;

/**
 * TVD 数据库客户端工厂。
 *
 * 两条后端路径，接口一致：
 *  - 配了 DATABASE_URL → node-postgres 连真实 PostgreSQL（生产/联调）
 *  - 没配 → PGlite 进程内 Postgres，落文件（本地开发与演示）
 *
 * 为什么要有 PGlite 这条路：现有运行时走 Supabase REST，而 TVD 的评分、冲突检测、
 * 独立性归并都是多表事务 + 窗口函数，REST 层写不出来。PGlite 让我们在没有外部
 * 数据库的机器上就能跑完整链路，且 SQL 语义与生产 Postgres 同源。
 *
 * 已知限制：PGlite 无法加载 db/schema.sql（第 12 行 CREATE EXTENSION vector，
 * 而 0.5.17 未捆绑 pgvector），所以本地库里没有 legacy 业务表。TVD 表因此
 * 不引用 legacy 表，指向 legacy 的列由仓储层校验。
 */

export type TvdDbKind = 'postgres' | 'pglite';

export type TvdDb = {
  kind: TvdDbKind;
  /**
   * 两个驱动的 drizzle 实例只在查询结果 HKT 上不同（PGlite 是 Promise 包装、
   * node-postgres 是 callback 包装），builder 接口与 SQL 语义一致。
   * 统一按 NodePg 类型暴露，代价是这一处转换；否则每个仓储都要为 kind 写分支。
   */
  db: NodePgDatabase<TvdSchema>;
  /** 执行多语句 DDL；参数化查询走 query。 */
  exec: (sql: string) => Promise<void>;
  /**
   * 两种驱动都归一成 rows 数组。
   * 之所以自己包一层：node-postgres 返回 { rows }、PGlite 的 .query() 也是 { rows }
   * 但 .exec() 返回数组，直接依赖驱动返回值会让同一份代码在两条路径下行为不同。
   */
  query: <T extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;
  /**
   * 在同一个连接上跑完一段 DDL。
   * node-postgres 的 Pool 每次 query 可能拿到不同连接，
   * 因此 BEGIN/COMMIT 绝不能通过多次 exec 发出 —— 那样事务根本不成立，
   * 迁移失败时会留下半套表。
   */
  inTransaction: (
    run: (tx: {
      exec: (sql: string) => Promise<void>;
      query: <T extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;
    }) => Promise<void>,
  ) => Promise<void>;
  close: () => Promise<void>;
  /** PGlite 数据目录或 Postgres 主机，用于健康检查展示。 */
  location: string;
};

type GlobalWithTvd = typeof globalThis & {
  __tvdDb?: Promise<TvdDb>;
};

/** 数据目录：仓库内 .runtime/ 已被 .gitignore 忽略，不会污染版本库。 */
function pgliteDataDir(): string {
  return process.env.TVD_PGLITE_DIR ?? '.runtime/pglite/tvd';
}

async function createPgliteHandle(): Promise<TvdDb> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');
  const dataDir = pgliteDataDir();

  // PGlite 只创建最后一级目录，.runtime/pglite/tvd 这种嵌套路径会 ENOENT。
  mkdirSync(resolve(dataDir), { recursive: true });

  const client = new PGlite({ dataDir, extensions: { pg_trgm } });
  await client.waitReady;

  return {
    kind: 'pglite',
    db: drizzlePglite(client, { schema: tvdSchema }) as unknown as NodePgDatabase<TvdSchema>,
    exec: async (sql: string) => {
      await client.exec(sql);
    },
    query: async <T extends QueryResultRow>(sql: string, params?: unknown[]) => {
      const res = await client.query<T>(sql, params);
      return res.rows;
    },
    inTransaction: async (run) => {
      // PGlite 是单连接的进程内 Postgres，同一时刻只有一个会话，
      // 因此直接用 client 的事务原语即可。
      await client.transaction(async (tx) => {
        await run({
          exec: async (sql: string) => {
            await tx.exec(sql);
          },
          query: async <T extends QueryResultRow>(sql: string, params?: unknown[]) => {
            const res = await tx.query<T>(sql, params);
            return res.rows;
          },
        });
      });
    },
    close: () => client.close(),
    location: dataDir,
  };
}

async function createPostgresHandle(connectionString: string): Promise<TvdDb> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: Number(process.env.TVD_POOL_MAX ?? 10) });

  // gen_random_uuid() 在 PG13+ 是内置函数，PGlite 也是 17；低于 13 需要 pgcrypto，
  // 否则 38 张表的 PRIMARY KEY DEFAULT 全部插入失败。
  const version = await pool.query('show server_version_num');
  if (Number(version.rows[0]?.server_version_num ?? 0) < 130000) {
    await pool.query('create extension if not exists pgcrypto');
  }

  return {
    kind: 'postgres',
    db: drizzlePg(pool, { schema: tvdSchema }),
    exec: async (sql: string) => {
      await pool.query(sql);
    },
    query: async <T extends QueryResultRow>(sql: string, params?: unknown[]) => {
      const res = await pool.query<T>(sql, params);
      return res.rows;
    },
    inTransaction: async (run) => {
      const conn = await pool.connect();
      try {
        await conn.query('BEGIN');
        await run({
          exec: async (sql: string) => {
            await conn.query(sql);
          },
          query: async <T extends QueryResultRow>(sql: string, params?: unknown[]) => {
            const res = await conn.query<T>(sql, params);
            return res.rows;
          },
        });
        await conn.query('COMMIT');
      } catch (err) {
        await conn.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        conn.release();
      }
    },
    close: () => pool.end(),
    location: connectionString.replace(/:\/\/[^:]*:[^@]*@/, '://***:***@'),
  };
}

/**
 * 单例挂在 globalThis 上：Next dev 的热更新会重新求值本模块，
 * 若每次新建 PGlite 实例，第二个实例会在同一数据目录上抢锁失败。
 */
export function getTvdDb(): Promise<TvdDb> {
  const g = globalThis as GlobalWithTvd;
  if (!g.__tvdDb) {
    g.__tvdDb = (async () => {
      const url = process.env.DATABASE_URL?.trim();
      return url ? createPostgresHandle(url) : createPgliteHandle();
    })().catch((err) => {
      // 失败不缓存，否则一次瞬时错误会永久毒化这个 Promise。
      g.__tvdDb = undefined;
      throw err;
    });
  }
  return g.__tvdDb;
}
