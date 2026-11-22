import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getGateway, type ChatMessage } from '@/server/ai/gateway';

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant', 'tool']),
      content: z.string().min(1),
    }),
  ).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(8192).optional(),
  task_type: z.string().optional(),
});

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

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const { messages, temperature, max_tokens, task_type } = parsed.data;

  const gateway = getGateway();
  try {
    const result = await gateway.chat({
      tenantId: user.tenantId,
      taskType: task_type ?? 'chat',
      chatParams: {
        messages: messages as ChatMessage[],
        temperature,
        maxTokens: max_tokens,
      },
    });

    return jsonResponse(
      success({
        text: result.text,
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        total_tokens: result.totalTokens,
        finish_reason: result.finishReason,
        tool_calls: result.toolCalls ?? [],
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 服务调用失败';
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code: number }).code
        : ErrorCode.AI_SERVICE_UNAVAILABLE;
    return jsonResponse(error(code, message), 503);
  }
}