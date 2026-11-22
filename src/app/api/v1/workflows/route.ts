import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listWorkflowDefs, createWorkflowDef } from '@/server/modules/collab/workflow-engine';

const listSchema = z.object({
  status: z.string().optional(),
  keyword: z.string().optional(),
});

const createSchema = z.object({
  code: z.string().min(1, '流程编码不能为空'),
  name: z.string().min(1, '流程名称不能为空'),
  definition: z.object({
    type: z.enum(['SEQUENTIAL', 'PARALLEL', 'CONDITIONAL', 'HUMAN_APPROVAL', 'AI_PIPELINE', 'EVENT_DRIVEN', 'HYBRID']).optional(),
    startNodeKey: z.string(),
    endNodeKey: z.string().optional(),
    collaborationId: z.string().optional(),
    nodes: z.array(
      z.object({
        key: z.string(),
        type: z.enum([
          'START', 'END', 'TASK', 'AI_AGENT', 'HUMAN', 'APPROVAL',
          'CONDITION', 'PARALLEL', 'JOIN', 'DATA', 'API',
          'NOTIFICATION', 'DELAY', 'SUBWORKFLOW', 'ARTIFACT',
          'ai_task', 'human_task', 'approval', 'condition', 'notify', 'integration',
        ]),
        name: z.string(),
        assigneeId: z.string().optional(),
        approverIds: z.array(z.string()).optional(),
        approvalMode: z.enum(['or', 'and', 'add']).optional(),
        condition: z.string().optional(),
        nextNodeKey: z.string().optional(),
        parallelBranches: z.array(z.string()).optional(),
        joinKeys: z.array(z.string()).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        idempotentKey: z.string().optional(),
      }),
    ),
  }),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listSchema.safeParse(params);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const items = await listWorkflowDefs(user.tenantId, {
    status: parsed.data.status,
    keyword: parsed.data.keyword,
  });

  return jsonResponse(success({ items, total: items.length }));
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

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
    const def = await createWorkflowDef(user.tenantId, user.id, {
      code: parsed.data.code,
      name: parsed.data.name,
      definition: parsed.data.definition,
    });

    return jsonResponse(success(def), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建流程定义失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}