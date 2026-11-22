import { createHash } from 'node:crypto';

/**
 * TVD 演示数据的租户/分行作用域。
 *
 * 为什么需要这个文件：src/lib/config.ts 的 DEMO_MODE 会话返回的是 slug
 * （src/lib/demo-users.ts:28 `tenantId = 'demo-tenant-001'`、:43 `id = 'demo-admin-001'`），
 * 而 db/schema.sql:33/:67 里 legacy tenant.id 与 app_user.id 都是 uuid。
 * slug 塞进 uuid 列会被 Postgres 拒绝 —— legacy enterprise 模块在本地查不到数据，
 * 根因就是这个错配。TVD 这边把"演示作用域用哪三个 uuid"收敛到一处，
 * seed 与查询共用，避免任何一侧自己编一个 id。
 *
 * 真实部署时不应再用这些常量，而应由 tenant 表解析出的 uuid 传入。
 */

export const TVD_DEMO_TENANT_ID = '11111111-1111-4111-8111-111111111101';
export const TVD_DEMO_BANK_ID = '22222222-2222-4222-8222-222222222201';
export const TVD_DEMO_USER_ID = '33333333-3333-4333-8333-333333333301';

/** 工行演示分行，报告与对标的 bank_id 维度用它。 */
export const TVD_DEMO_BANK_NAME = '中国工商银行·科技金融部（演示）';

export type TvdScope = { tenantId: string; bankId: string; userId: string };

export const TVD_DEMO_SCOPE: TvdScope = {
  tenantId: TVD_DEMO_TENANT_ID,
  bankId: TVD_DEMO_BANK_ID,
  userId: TVD_DEMO_USER_ID,
};

/** 稳定 id 的唯一生成规则：seed 与查询都用它，两侧不会各自编一个 uuid。 */
export function uuidFrom(seed: string): string {
  const h = createHash('md5').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** slug → uuid；已经是 uuid 就原样通过。 */
export function toScopeUuid(value: string | null | undefined, kind: 'tenant' | 'user'): string {
  if (!value) return kind === 'tenant' ? TVD_DEMO_TENANT_ID : TVD_DEMO_USER_ID;
  if (UUID_RE.test(value)) return value;
  if (kind === 'tenant' && value === 'demo-tenant-001') return TVD_DEMO_TENANT_ID;
  return uuidFrom(`${kind}:${value}`);
}

/**
 * 会话用户 → TVD 数据作用域。
 *
 * bank_id 暂时恒为演示分行：会话里没有分行信息，legacy app_user 也没有 bank 字段。
 * 接真实核心系统时，这里改成按 org 映射出的分行 uuid，其余调用方不用动。
 */
export function resolveTvdScope(user: { tenantId: string; id?: string | null }): TvdScope {
  return {
    tenantId: toScopeUuid(user.tenantId, 'tenant'),
    bankId: TVD_DEMO_BANK_ID,
    userId: toScopeUuid(user.id ?? null, 'user'),
  };
}

