import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listConflicts, createConflict, type ConflictType, type ConflictSeverity } from '@/server/modules/collab/conflict-service';

const createSchema = z.object({
  type: z.enum([
    'DATA_CONFLICT', 'OPINION_CONFLICT', 'RESOURCE_CONFLICT', 'PRIORITY_CONFLICT',
    'SCOPE_CONFLICT', 'PROCESS_CONFLICT', 'TECHNICAL_CONFLICT', 'SCHEDULE_CONFLICT',
    'BUDGET_CONFLICT', 'GOAL_CONFLICT',
  ]),
  description: z.string().min(1, '冲突描述不能为空'),
  contextIds: z.array(z.string()).default([]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;
  const statusFilter = request.nextUrl.searchParams.get('status');
  const typeFilter = request.nextUrl.searchParams.get('type');
  const severityFilter = request.nextUrl.searchParams.get('severity');

  const filter: { status?: string; type?: string; severity?: string } = {};
  if (statusFilter) filter.status = statusFilter;
  if (typeFilter) filter.type = typeFilter;
  if (severityFilter) filter.severity = severityFilter;

  const conflicts = await listConflicts(user.tenantId, id, filter as { status?: never; type?: never; severity?: never } | undefined);

  return jsonResponse(success({ items: conflicts }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const conflict = await createConflict(
      user.tenantId,
      id,
      parsed.data.type as ConflictType,
      parsed.data.description,
      parsed.data.contextIds,
      parsed.data.severity as ConflictSeverity | undefined,
    );

    return jsonResponse(success(conflict), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建冲突记录失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}