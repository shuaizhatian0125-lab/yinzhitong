import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listCampaigns, createCampaign } from '@/server/modules/marketing/marketing-service';

const searchSchema = z.object({
  status: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1, '活动名称不能为空'),
  segment_id: z.string().optional(),
  objective: z.string().optional(),
  channel: z.string().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  budget: z.number().int().min(0).optional(),
  owner_id: z.string().optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = searchSchema.safeParse(params);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const campaigns = await listCampaigns(user.tenantId, {
    status: parsed.data.status,
  });

  return jsonResponse(success({ items: campaigns }));
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
    const campaign = await createCampaign(user.tenantId, {
      name: parsed.data.name,
      segmentId: parsed.data.segment_id,
      objective: parsed.data.objective,
      channel: parsed.data.channel,
      startAt: parsed.data.start_at,
      endAt: parsed.data.end_at,
      budget: parsed.data.budget,
      ownerId: parsed.data.owner_id,
    });

    return jsonResponse(success(campaign), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建营销活动失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}