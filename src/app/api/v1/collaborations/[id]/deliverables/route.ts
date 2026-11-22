import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listDeliverables, createDeliverable, type DeliverableType } from '@/server/modules/collab/deliverable-service';

const createSchema = z.object({
  title: z.string().min(1, '成果标题不能为空'),
  type: z.enum(['REPORT', 'DOCUMENT', 'DATA', 'ANALYSIS', 'DECISION', 'PLAN', 'OTHER']),
  content: z.string().min(1, '成果内容不能为空'),
  sourceWorkstreamId: z.string().optional(),
  sourceTaskIds: z.array(z.string()).default([]),
  traceability: z.object({
    taskIds: z.array(z.string()).default([]),
    agentRunIds: z.array(z.string()).default([]),
    knowledgeSources: z.array(z.string()).default([]),
    dataSources: z.array(z.string()).default([]),
  }).optional(),
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

  const filter: { status?: string; type?: string } = {};
  if (statusFilter) filter.status = statusFilter;
  if (typeFilter) filter.type = typeFilter;

  const deliverables = await listDeliverables(user.tenantId, id, filter as { status?: never; type?: never } | undefined);

  return jsonResponse(success({ items: deliverables }));
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
    const deliverable = await createDeliverable(
      user.tenantId,
      id,
      parsed.data.title,
      parsed.data.type as DeliverableType,
      parsed.data.content,
      parsed.data.sourceWorkstreamId,
      parsed.data.sourceTaskIds,
      parsed.data.traceability,
    );

    return jsonResponse(success(deliverable), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建成果失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}