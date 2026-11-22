import { NextRequest } from 'next/server';
import { error, ErrorCode, jsonResponse, success } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getTvdDb } from '@/storage/database/tvd/client';
import { getTvdEnterpriseDetail } from '@/server/modules/tvd-data/repository';
import { resolveTvdScope } from '@/server/modules/tvd-data/scope';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '企业 ID 格式不正确'), 400);
  }

  const handle = await getTvdDb();
  const detail = await getTvdEnterpriseDetail(resolveTvdScope(user), id, handle);
  if (!detail) {
    // 404 而不是空对象：跨 tenant/bank 取别人的企业必须表现为"不存在"。
    return jsonResponse(error(ErrorCode.NOT_FOUND, '企业不存在或不在当前数据范围内'), 404);
  }

  return jsonResponse(success({ is_demo: true, backend: handle.kind, ...detail }));
}
