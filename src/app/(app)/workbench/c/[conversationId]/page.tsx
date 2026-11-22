'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { AiRunTimeline } from '@/components/domain/AiRunTimeline';
import { AiResultCard } from '@/components/domain/AiResultCard';
import { AiConfirmCard } from '@/components/domain/AiConfirmCard';
import { AiStepList } from '@/components/domain/AiStepList';

type Conversation = {
  id: string;
  title: string;
  agentCode: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type RunStep = {
  seq: number;
  kind: string;
  description: string;
  toolCode?: string | null;
  status?: string;
};

type ChatMessageItem = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  runId?: string;
  steps?: RunStep[];
  result?: Record<string, unknown>;
  needsConfirm?: boolean;
  confirmRunId?: string;
  riskLevel?: string;
  status?: string;
};

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const router = useRouter();
  const conversationId = params.conversationId;

  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [messages, setMessages] = React.useState<ChatMessageItem[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [loadingConvs, setLoadingConvs] = React.useState(true);
  const [loadingMsgs, setLoadingMsgs] = React.useState(true);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    loadConversations();
  }, []);

  React.useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
    }
  }, [conversationId]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConversations() {
    setLoadingConvs(true);
    try {
      const res = await fetch('/api/v1/ai/conversations');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setConversations(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingConvs(false);
    }
  }

  async function loadMessages(convId: string) {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/v1/ai/conversations/${convId}/messages`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setMessages(
          (json.data.items ?? []).map((m: Message) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: m.createdAt,
          })),
        );
      }
    } catch {
      // ignore
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    const userMsg: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(`/api/v1/ai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const contentType = res.headers.get('content-type') ?? '';

      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantMsg: ChatMessageItem = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
        };
        let msgAdded = false;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            let currentEvent = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith('data: ') && currentEvent) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (currentEvent === 'status') {
                    if (!msgAdded) {
                      msgAdded = true;
                      assistantMsg.runId = data.runId;
                      assistantMsg.status = data.status;
                      setMessages((prev) => [...prev, assistantMsg]);
                    } else {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === assistantMsg.id ? { ...m, status: data.status } : m,
                        ),
                      );
                    }
                  } else if (currentEvent === 'step') {
                    assistantMsg.steps = data.steps;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsg.id ? { ...m, steps: data.steps } : m,
                      ),
                    );
                  } else if (currentEvent === 'confirm') {
                    assistantMsg.needsConfirm = true;
                    assistantMsg.confirmRunId = data.runId;
                    assistantMsg.riskLevel = data.riskLevel;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsg.id
                          ? { ...m, needsConfirm: true, confirmRunId: data.runId, riskLevel: data.riskLevel }
                          : m,
                      ),
                    );
                  } else if (currentEvent === 'result') {
                    assistantMsg.result = data.result;
                    assistantMsg.content = JSON.stringify(data.result, null, 2);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsg.id
                          ? { ...m, result: data.result, content: JSON.stringify(data.result, null, 2) }
                          : m,
                      ),
                    );
                  } else if (currentEvent === 'error') {
                    assistantMsg.content = `执行出错：${data.message ?? '未知错误'}`;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsg.id ? { ...m, content: `执行出错：${data.message ?? '未知错误'}` } : m,
                      ),
                    );
                  } else if (currentEvent === 'done') {
                    assistantMsg.status = data.status;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsg.id ? { ...m, status: data.status } : m,
                      ),
                    );
                  }
                } catch {
                  // ignore parse errors
                }
                currentEvent = '';
              }
            }
          }
        }
      } else {
        const json = await res.json();
        if (json.code === 0 && json.data?.clarification) {
          const aiMsg: ChatMessageItem = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: json.data.question ?? '请提供更多信息。',
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, aiMsg]);
        }
      }
    } catch {
      const errorMsg: ChatMessageItem = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '网络错误，请稍后重试。',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }

  async function handleNewConversation() {
    try {
      const res = await fetch('/api/v1/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        router.push(`/workbench/c/${json.data.id}`);
      }
    } catch {
      // ignore
    }
  }

  async function handleDeleteConversation(convId: string) {
    try {
      await fetch(`/api/v1/ai/conversations/${convId}`, { method: 'DELETE' });
      loadConversations();
      if (convId === conversationId) {
        router.push('/workbench');
      }
    } catch {
      // ignore
    }
  }

  async function handleConfirm(runId: string) {
    try {
      const res = await fetch(`/api/v1/ai/runs/${runId}/confirm`, { method: 'POST' });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.confirmRunId === runId
              ? { ...m, needsConfirm: false, result: json.data.result, content: JSON.stringify(json.data.result ?? {}, null, 2) }
              : m,
          ),
        );
      }
    } catch {
      // ignore
    }
  }

  async function handleCancel(runId: string) {
    try {
      await fetch(`/api/v1/ai/runs/${runId}/cancel`, { method: 'POST' });
      setMessages((prev) =>
        prev.map((m) =>
          m.confirmRunId === runId ? { ...m, needsConfirm: false, content: '已取消执行' } : m,
        ),
      );
    } catch {
      // ignore
    }
  }

  async function handleToTask(runId: string) {
    try {
      const res = await fetch(`/api/v1/ai/runs/${runId}/to-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'AI生成任务' }),
      });
      const json = await res.json();
      if (json.code === 0) {
        router.push(`/work/tasks/${json.data.task.id}`);
      }
    } catch {
      // ignore
    }
  }

  async function handleToDocument(runId: string) {
    try {
      const res = await fetch(`/api/v1/ai/runs/${runId}/to-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'AI生成文档' }),
      });
      const json = await res.json();
      if (json.code === 0) {
        // navigate to document if route exists
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-3">
      {/* 左侧：会话列表 */}
      <div className="w-64 shrink-0 bz-card flex flex-col" style={{ borderRadius: 4 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">会话列表</span>
          <button
            onClick={handleNewConversation}
            className="bz-btn bz-btn-ghost p-1"
            title="新建会话"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {loadingConvs ? (
            <div className="text-center py-4 text-[12px] text-[var(--bz-text-muted)]">加载中…</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-4 text-[12px] text-[var(--bz-text-muted)]">暂无会话</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => router.push(`/workbench/c/${conv.id}`)}
                className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                  conv.id === conversationId ? 'bg-[#fafcfe]' : 'hover:bg-[#fafcfe]'
                }`}
                style={{ borderRadius: 3 }}
              >
                <span className="text-[13px] text-[var(--bz-text)] flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                  className="text-[var(--bz-text-muted)] hover:text-[var(--bz-danger)] shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 中部：对话流 */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex-1 overflow-auto bz-card" style={{ borderRadius: 4 }}>
          {loadingMsgs ? (
            <div className="text-center py-8 text-[14px] text-[var(--bz-text-muted)]">加载消息中…</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-[14px] text-[var(--bz-text-muted)]">
              开始新的对话，输入您的需求…
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4">
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-2">
                  {/* 用户消息 */}
                  {msg.role === 'user' && (
                    <div className="flex justify-end">
                      <div
                        className="max-w-[70%] px-4 py-2.5 rounded"
                        style={{ background: 'var(--bz-brand)', color: '#fff', borderRadius: 4 }}
                      >
                        <p className="text-[14px] leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  )}

                  {/* AI 回复 */}
                  {msg.role === 'assistant' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[12px] font-medium"
                          style={{ color: 'var(--bz-brand)' }}
                        >
                          AI 助理
                        </span>
                        {msg.status && msg.status !== 'succeeded' && msg.status !== 'done' && (
                          <Loader2 className="h-3 w-3 animate-spin text-[var(--bz-text-muted)]" />
                        )}
                      </div>

                      {/* 步骤列表 */}
                      {msg.steps && msg.steps.length > 0 && (
                        <AiStepList steps={msg.steps} />
                      )}

                      {/* 执行时间线 */}
                      {msg.steps && msg.steps.length > 0 && msg.result && (
                        <AiRunTimeline steps={msg.steps} />
                      )}

                      {/* 确认卡 */}
                      {msg.needsConfirm && msg.confirmRunId && (
                        <AiConfirmCard
                          runId={msg.confirmRunId}
                          riskLevel={msg.riskLevel}
                          message="该操作需要您的确认后才能执行。"
                          onConfirm={() => handleConfirm(msg.confirmRunId!)}
                          onCancel={() => handleCancel(msg.confirmRunId!)}
                        />
                      )}

                      {/* 结果卡 */}
                      {msg.result && !msg.needsConfirm && (
                        <AiResultCard
                          result={msg.result}
                          onToTask={msg.runId ? () => handleToTask(msg.runId!) : undefined}
                          onToDocument={msg.runId ? () => handleToDocument(msg.runId!) : undefined}
                        />
                      )}

                      {/* 纯文本回复 */}
                      {!msg.result && !msg.needsConfirm && !msg.steps && msg.content && (
                        <div
                          className="max-w-[80%] px-4 py-2.5 rounded"
                          style={{ background: 'var(--bz-bg)', borderRadius: 4, border: '1px solid var(--bz-line)' }}
                        >
                          <p className="text-[14px] text-[var(--bz-text)] leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 底部：输入框 */}
        <div
          className="flex items-center gap-2 px-3 py-2 bz-card"
          style={{ borderRadius: 4 }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入消息…（Enter 发送）"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--bz-text-muted)]"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="bz-btn bz-btn-primary p-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}