import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import {
  generateText,
  streamText,
  embed as aiEmbed,
  type ModelMessage,
  type SystemModelMessage,
  type ToolSet,
} from 'ai';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
};

export type ChatParams = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Record<string, unknown>;
};

export type ChatResult = {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
  toolCalls?: Array<{
    toolName: string;
    args: Record<string, unknown>;
  }>;
};

export type StreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown> }
  | { type: 'done'; promptTokens: number; completionTokens: number; totalTokens: number }
  | { type: 'error'; message: string };

export type ProviderConfig = {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  apiKey: string | null;
  models: unknown[];
  capabilities: string[];
  priority: number;
};

export interface ProviderAdapter {
  chat(params: ChatParams): Promise<ChatResult>;
  streamChat(params: ChatParams): AsyncGenerator<StreamChunk>;
  embed(text: string): Promise<number[]>;
}

/**
 * ai@7 起，system 角色不能再出现在 messages 里（allowSystemInMessages 默认 false），
 * 必须走 instructions。业务层（src/app/api/v1/ai/chat/route.ts 的 schema 就允许
 * role:'system'）传的是混合数组，所以在这里统一拆分：
 * 拆错一处，所有带系统提示的 AI 调用都会以 Invalid prompt 失败。
 */
function toInstructions(messages: ChatMessage[]): SystemModelMessage[] {
  return messages
    .filter((msg) => msg.role === 'system')
    .map((msg) => ({ role: 'system', content: msg.content }));
}

function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter((msg): msg is Exclude<ChatMessage, { role: 'system' }> => msg.role !== 'system')
    .map((msg): ModelMessage => {
      if (msg.role === 'user') {
        return { role: 'user', content: msg.content };
      }
      if (msg.role === 'assistant') {
        return { role: 'assistant', content: msg.content };
      }
      return { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'unknown', toolName: 'unknown', output: msg.content }] } as unknown as ModelMessage;
    });
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  private readonly provider: OpenAIProvider;
  private readonly defaultModelId: string;
  private readonly defaultEmbeddingModelId: string;

  constructor(config: ProviderConfig) {
    this.provider = createOpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey ?? 'dummy-key',
    });
    this.defaultModelId = (config.models?.[0] as string) ?? 'gpt-4o-mini';
    this.defaultEmbeddingModelId =
      (config.models?.find((m) => {
        if (typeof m !== 'string') return false;
        return m.includes('embedding') || m.includes('embed');
      }) as string | undefined) ?? 'text-embedding-3-small';
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const model = this.provider(this.defaultModelId);
    const result = await generateText({
      model,
      instructions: toInstructions(params.messages),
      messages: toModelMessages(params.messages),
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.maxTokens,
      tools: (params.tools ?? {}) as ToolSet,
    });

    const promptTokens = result.usage.inputTokens ?? 0;
    const completionTokens = result.usage.outputTokens ?? 0;

    return {
      text: result.text,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      finishReason: result.finishReason ?? 'stop',
      toolCalls: result.toolCalls?.map((tc) => ({
        toolName: tc.toolName,
        args: (tc as { input?: unknown }).input as Record<string, unknown>,
      })),
    };
  }

  async *streamChat(params: ChatParams): AsyncGenerator<StreamChunk> {
    const model = this.provider(this.defaultModelId);
    const result = streamText({
      model,
      instructions: toInstructions(params.messages),
      messages: toModelMessages(params.messages),
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.maxTokens,
      tools: (params.tools ?? {}) as ToolSet,
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta': {
          yield { type: 'delta', text: part.text };
          break;
        }
        case 'tool-call': {
          yield {
            type: 'tool-call',
            toolName: part.toolName,
            args: (part as { input?: unknown }).input as Record<string, unknown>,
          };
          break;
        }
        case 'error': {
          const err = part.error;
          const message =
            err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown stream error';
          yield { type: 'error', message };
          break;
        }
        case 'finish': {
          const usage = part.totalUsage;
          const promptTokens = usage.inputTokens ?? 0;
          const completionTokens = usage.outputTokens ?? 0;
          yield {
            type: 'done',
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          };
          break;
        }
      }
    }
  }

  async embed(text: string): Promise<number[]> {
    const embeddingModel = this.provider.embedding(this.defaultEmbeddingModelId);
    const result = await aiEmbed({
      model: embeddingModel,
      value: text,
    });
    return result.embedding;
  }
}

export function createAdapter(providerConfig: ProviderConfig): ProviderAdapter {
  switch (providerConfig.kind) {
    case 'openai_compatible':
    case 'openai':
    case 'qwen':
    case 'vllm':
      return new OpenAICompatibleAdapter(providerConfig);
    default:
      return new OpenAICompatibleAdapter(providerConfig);
  }
}