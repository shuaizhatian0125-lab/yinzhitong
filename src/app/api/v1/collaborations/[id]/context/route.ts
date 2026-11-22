import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listContext, addContext, type ContextType, type SensitivityLevel } from '@/server/modules/collab/shared-context-service';

const createSchema = z.object({
  contextType: z.enum([
    'GOAL', 'SCOPE', 'FACT', 'ASSUMPTION', 'DECISION',
    'CONSTRAINT', 'DATA', 'FINDING', 'ARTIFACT_REF',
  ]),
  content: z.string().min(1, '内容不能为空'),
  confidenceScore: z.number().min(0).max(1).optional(),
  source: z.string().optional(),
  sensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
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
  const contextTypeFilter = request.nextUrl.searchParams.get('contextType');
  const minConfidenceFilter = request.nextUrl.searchParams.get('minConfidence');
  const statusFilter = request.nextUrl.searchParams.get('status');

  const filter: { contextType?: string; minConfidence?: number; status?: string } = {};
  if (contextTypeFilter) filter.contextType = contextTypeFilter;
  if (minConfidenceFilter) filter.minConfidence = Number(minConfidenceFilter);
  if (statusFilter) filter.status = statusFilter;

  const contexts = await listContext(user.tenantId, id, filter as { contextType?: never; minConfidence?: never; status?: never } | undefined);

  return jsonResponse(success({ items: contexts }));
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
    const context = await addContext(
      user.tenantId,
      id,
      parsed.data.contextType as ContextType,
      parsed.data.content,
      {
        confidenceScore: parsed.data.confidenceScore,
        source: parsed.data.source,
        sensitivity: parsed.data.sensitivity as SensitivityLevel | undefined,
        createdBy: user.id,
      },
    );

    return jsonResponse(success(context), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '添加 Context 失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}