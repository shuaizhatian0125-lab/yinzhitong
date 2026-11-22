import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getConversation, addMessage, listMessages } from '@/server/modules/workbench/conversation-service';
import { routeIntent } from '@/server/ai/runtime/intent-router';
import { generatePlan } from '@/server/ai/runtime/planner';
import { createAiRun, executeRun, confirmRun, cancelRun } from '@/server/ai/runtime/executor';
import { getGateway, type ChatMessage } from '@/server/ai/gateway';
import { isDemoMode } from '@/lib/config';
import type { Plan } from '@/server/ai/runtime/planner';

const sendMessageSchema = z.object({
  content: z.string().min(1).max(8000),
  agentCode: z.string().max(64).optional(),
});

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const conversation = await getConversation(user, id);
  if (!conversation) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '会话不存在'), 404);
  }

  const messages = await listMessages(user, id);
  return jsonResponse(success({ items: messages }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id: conversationId } = await params;
  const conversation = await getConversation(user, conversationId);
  if (!conversation) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '会话不存在'), 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const { content } = parsed.data;

  await addMessage(user, conversationId, { role: 'user', content });

  const route = routeIntent(content, {
    user,
    conversationId,
    currentModule: 'workbench',
  });

  if (route.needsClarification) {
    await addMessage(user, conversationId, {
      role: 'assistant',
      content: route.clarificationQuestion ?? '请提供更多信息。',
    });
    return jsonResponse(success({
      clarification: true,
      question: route.clarificationQuestion,
    }));
  }

  const plan = generatePlan(route.agentCode, content, { conversationId }, route.complexity);
  if (!plan) {
    await addMessage(user, conversationId, {
      role: 'assistant',
      content: '抱歉，无法处理您的请求。',
    });
    return jsonResponse(success({ error: '无法生成执行计划' }));
  }

  const runId = isDemoMode ? crypto.randomUUID() : await createAiRun({
    tenantId: user.tenantId,
    conversationId,
    userId: user.id,
    agentCode: route.agentCode,
    goal: content,
    plan,
    riskLevel: plan.riskLevel,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(formatSSE('status', {
          runId,
          agentCode: route.agentCode,
          complexity: route.complexity,
          status: 'queued',
        })));

        if (plan.steps.length > 0) {
          controller.enqueue(encoder.encode(formatSSE('step', {
            steps: plan.steps.map((s) => ({
              seq: s.seq,
              kind: s.kind,
              description: s.description,
              toolCode: s.toolCode ?? null,
            })),
          })));
        }

        if (plan.requiresConfirmation) {
          controller.enqueue(encoder.encode(formatSSE('confirm', {
            runId,
            riskLevel: plan.riskLevel,
            message: '该操作需要您的确认后才能执行。',
          })));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(formatSSE('status', {
          runId,
          status: 'running',
        })));

        if (isDemoMode) {
          try {
            const gateway = getGateway();
            const chatMessages: ChatMessage[] = [
              { role: 'user', content },
            ];
            const result = await gateway.chat({
              tenantId: user.tenantId,
              taskType: route.agentCode,
              chatParams: { messages: chatMessages },
            });

            const replyText = result.text || '抱歉，我无法处理您的请求。';
            await addMessage(user, conversationId, {
              role: 'assistant',
              content: replyText,
            });

            controller.enqueue(encoder.encode(formatSSE('result', {
              runId,
              result: { reply: replyText },
              steps: plan.steps.map((s) => ({
                seq: s.seq,
                kind: s.kind,
                description: s.description,
                status: 'succeeded',
              })),
            })));

            controller.enqueue(encoder.encode(formatSSE('done', {
              runId,
              status: 'succeeded',
            })));
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'AI服务调用失败';
            await addMessage(user, conversationId, {
              role: 'assistant',
              content: `执行出错：${errMsg}`,
            });
            controller.enqueue(encoder.encode(formatSSE('error', { runId, message: errMsg })));
            controller.enqueue(encoder.encode(formatSSE('done', { runId, status: 'failed' })));
          } finally {
            controller.close();
          }
          return;
        }

        const result = await executeRun(runId, user);

        if (result.status === 'succeeded' && result.result) {
          const resultText = JSON.stringify(result.result);
          await addMessage(user, conversationId, {
            role: 'assistant',
            content: resultText,
          });

          controller.enqueue(encoder.encode(formatSSE('result', {
            runId,
            result: result.result,
            steps: result.steps,
          })));
        } else if (result.status === 'failed') {
          controller.enqueue(encoder.encode(formatSSE('error', {
            runId,
            message: result.error ?? '执行失败',
          })));
        }

        controller.enqueue(encoder.encode(formatSSE('done', {
          runId,
          status: result.status,
        })));
      } catch (err) {
        const message = err instanceof Error ? err.message : '流式执行失败';
        controller.enqueue(encoder.encode(formatSSE('error', { runId, message })));
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