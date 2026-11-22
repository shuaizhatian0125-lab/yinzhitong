import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getGateway } from '@/server/ai/gateway';
import type { ChatMessage } from '@/server/ai/gateway';

const aiDraftSchema = z.object({
  goal: z.string().min(1).max(2000),
  context: z.string().optional(),
});

type TaskDraft = {
  title: string;
  description: string;
  priority: string;
  estimatedDays: number;
  dependencies: string[];
};

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = aiDraftSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const systemPrompt = `你是任务规划助手。用户会给你一个业务目标，你需要将其分解为3-8个可执行的子任务。
每个子任务包含：title（标题）、description（描述）、priority（优先级P0-P3）、estimatedDays（预计天数）、dependencies（依赖的其他子任务序号，从1开始，空数组表示无依赖）。
请以JSON数组格式返回，不要包含其他文字。格式示例：
[{"title":"收集资料","description":"收集相关行业数据","priority":"P1","estimatedDays":2,"dependencies":[]},{"title":"撰写报告","description":"基于资料撰写分析报告","priority":"P2","estimatedDays":3,"dependencies":[1]}]`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: parsed.data.goal + (parsed.data.context ? `\n\n背景信息：${parsed.data.context}` : '') },
  ];

  const gateway = getGateway();
  try {
    const result = await gateway.chat({
      tenantId: user.tenantId,
      taskType: 'task_planning',
      chatParams: { messages },
    });

    let drafts: TaskDraft[] = [];
    try {
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        drafts = JSON.parse(jsonMatch[0]) as TaskDraft[];
      }
    } catch {
      drafts = [];
    }

    return jsonResponse(success({ drafts }));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI服务调用失败';
    return jsonResponse(error(ErrorCode.AI_SERVICE_UNAVAILABLE, message), 503);
  }
}