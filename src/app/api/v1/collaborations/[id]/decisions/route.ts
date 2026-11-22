import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listDecisions, createDecision, type DecisionType } from '@/server/modules/collab/decision-service';

const createSchema = z.object({
  type: z.enum([
    'STRATEGIC', 'RESOURCE', 'SCOPE', 'PRIORITY', 'RISK_MITIGATION',
    'PROCESS', 'TECHNICAL', 'PERSONNEL', 'BUDGET', 'EXTERNAL',
  ]),
  title: z.string().min(1, '决策标题不能为空'),
  description: z.string().min(1, '决策描述不能为空'),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    pros: z.array(z.string()).default([]),
    cons: z.array(z.string()).default([]),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  })).min(1, '至少需要一个选项'),
  deadline: z.string().optional(),
  requiredApprovers: z.array(z.string()).optional(),
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
  if (statusFilter) filter.status = statusFilter as string;
  if (typeFilter) filter.type = typeFilter as string;

  const decisions = await listDecisions(user.tenantId, id, filter as { status?: never; type?: never } | undefined);

  return jsonResponse(success({ items: decisions }));
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
    const decision = await createDecision(
      user.tenantId,
      id,
      parsed.data.type as DecisionType,
      parsed.data.title,
      parsed.data.description,
      parsed.data.options,
      parsed.data.deadline,
      parsed.data.requiredApprovers,
    );

    return jsonResponse(success(decision), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建决策失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}