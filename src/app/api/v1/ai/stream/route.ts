import { NextRequest } from 'next/server';
import { z } from 'zod';
import { error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getGateway, type ChatMessage } from '@/server/ai/gateway';

const streamSchema = z.object({
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

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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

  const parsed = streamSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const { messages, temperature, max_tokens, task_type } = parsed.data;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const gateway = getGateway();

      try {
        for await (const chunk of gateway.streamChat({
          tenantId: user.tenantId,
          taskType: task_type ?? 'chat',
          chatParams: {
            messages: messages as ChatMessage[],
            temperature,
            maxTokens: max_tokens,
          },
        })) {
          switch (chunk.type) {
            case 'delta':
              controller.enqueue(encoder.encode(formatSSE('delta', { text: chunk.text })));
              break;
            case 'tool-call':
              controller.enqueue(
                encoder.encode(
                  formatSSE('tool-call', {
                    tool_name: chunk.toolName,
                    args: chunk.args,
                  }),
                ),
              );
              break;
            case 'done':
              controller.enqueue(
                encoder.encode(
                  formatSSE('done', {
                    prompt_tokens: chunk.promptTokens,
                    completion_tokens: chunk.completionTokens,
                    total_tokens: chunk.totalTokens,
                  }),
                ),
              );
              break;
            case 'error':
              controller.enqueue(
                encoder.encode(formatSSE('error', { message: chunk.message })),
              );
              break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '流式聊天失败';
        controller.enqueue(encoder.encode(formatSSE('error', { message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}