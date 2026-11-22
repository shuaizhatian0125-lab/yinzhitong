import { NextRequest } from 'next/server';
import { z } from 'zod';
import { error, ErrorCode, jsonResponse, success } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getTvdDb } from '@/storage/database/tvd/client';
import { getTvdFacets, listTvdEnterprises } from '@/server/modules/tvd-data/repository';
import { getEnterpriseBoardStats } from '@/server/modules/tvd-data/stats';
import { resolveTvdScope } from '@/server/modules/tvd-data/scope';

const querySchema = z.object({
  keyword: z.string().trim().max(64).optional(),
  region: z.string().trim().max(64).optional(),
  industry: z.string().trim().max(64).optional(),
  track: z.string().trim().max(64).optional(),
  verification: z.enum(['unverified', 'single_source', 'multi_source', 'verified', 'disputed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * 企业板块读取入口（TVD 语料）。
 *
 * 单个 handle 贯穿本次请求：PGlite 是进程内单连接，
 * 每个 helper 各自 getTvdDb() 虽也拿到同一实例，但显式传下去能让"这次请求用了哪个后端"可判断。
 * 请求结束不 close —— 那个 handle 是进程级单例，关掉会把后面的请求一起打死。
 */
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const q = parsed.data;
  const scope = resolveTvdScope(user);
  const handle = await getTvdDb();

  const [list, facets, stats] = await Promise.all([
    listTvdEnterprises(scope, {
      keyword: q.keyword,
      region: q.region,
      industry: q.industry,
      track: q.track,
      verification: q.verification,
      page: q.page,
      pageSize: q.page_size,
    }, handle),
    getTvdFacets(scope, handle),
    getEnterpriseBoardStats(scope, handle),
  ]);

  return jsonResponse(
    success({
      backend: handle.kind,
      /** 语料全部来自演示 seed：页面上的 Demo 标记由这个字段驱动，不靠前端硬写。 */
      is_demo: true,
      items: list.items,
      total: list.total,
      page: list.page,
      page_size: list.pageSize,
      facets,
      stats,
    }),
  );
}
