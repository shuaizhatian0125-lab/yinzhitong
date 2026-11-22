import { getSupabaseClient } from '@/storage/database/supabase-client';
import { aiConfig } from '@/lib/config';
import { ErrorCode } from '@/lib/api-response';
import {
  createAdapter,
  type ProviderAdapter,
  type ProviderConfig,
  type ChatParams,
  type ChatResult,
  type StreamChunk,
} from './provider-adapter';

export type RouteResult = {
  adapter: ProviderAdapter;
  providerName: string;
  modelName: string;
  providerId: string;
};

export type FallbackEntry = {
  providerId: string;
  model: string;
};

type ModelRouteRow = {
  id: string;
  tenant_id: string;
  purpose: string;
  primary_provider_id: string | null;
  primary_model: string;
  fallback_chain: unknown[];
  params: Record<string, unknown>;
  enabled: boolean;
};

type ProviderRow = {
  id: string;
  tenant_id: string;
  name: string;
  kind: string;
  base_url: string;
  api_key_enc: string | null;
  models: unknown[];
  capabilities: string[];
  priority: number;
  status: string;
};

const SENSITIVE_PATTERNS: Array<{ regex: RegExp; replacement: string; label: string }> = [
  { regex: /\b\d{18}\b/g, replacement: '[身份证已脱敏]', label: 'id_card' },
  { regex: /\b1[3-9]\d{9}\b/g, replacement: '[手机号已脱敏]', label: 'mobile' },
  { regex: /\b\d{16,19}\b/g, replacement: '[银行卡号已脱敏]', label: 'bank_card' },
  { regex: /¥\s?[\d,]+\.?\d*/g, replacement: '[金额已脱敏]', label: 'amount_cny' },
  { regex: /\$[\d,]+\.?\d*/g, replacement: '[金额已脱敏]', label: 'amount_usd' },
];

export function sanitizeMessages(messages: ChatParams['messages']): ChatParams['messages'] {
  return messages.map((msg) => ({
    ...msg,
    content: SENSITIVE_PATTERNS.reduce(
      (content, pattern) => content.replace(pattern.regex, pattern.replacement),
      msg.content,
    ),
  }));
}

async function fetchRouteConfig(
  tenantId: string,
  purpose: string,
): Promise<ModelRouteRow | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('ai_model_route')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('purpose', purpose)
    .eq('enabled', true)
    .limit(1);

  return (data?.[0] as ModelRouteRow | undefined) ?? null;
}

async function fetchProvider(
  tenantId: string,
  providerId: string,
): Promise<ProviderRow | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('ai_provider')
    .select('*')
    .eq('id', providerId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(1);

  return (data?.[0] as ProviderRow | undefined) ?? null;
}

async function fetchDefaultProvider(tenantId: string): Promise<ProviderRow | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('ai_provider')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('priority', { ascending: true })
    .limit(1);

  return (data?.[0] as ProviderRow | undefined) ?? null;
}

function providerRowToConfig(row: ProviderRow): ProviderConfig {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    baseUrl: row.base_url,
    apiKey: row.api_key_enc,
    models: row.models,
    capabilities: row.capabilities,
    priority: row.priority,
  };
}

export async function routeModel(
  tenantId: string,
  taskType: string = 'chat',
): Promise<RouteResult> {
  let routeRow: ModelRouteRow | null = null;
  try {
    routeRow = await fetchRouteConfig(tenantId, taskType);
  } catch (err) {
    console.warn('[AI Gateway] DB query failed for route config, falling back to env:', err instanceof Error ? err.message : String(err));
  }

  if (routeRow) {
    const primaryProviderId = routeRow.primary_provider_id;
    if (primaryProviderId) {
      let providerRow: ProviderRow | null = null;
      try {
        providerRow = await fetchProvider(tenantId, primaryProviderId);
      } catch (err) {
        console.warn('[AI Gateway] DB query failed for primary provider, falling back:', err instanceof Error ? err.message : String(err));
      }
      if (providerRow) {
        const config = providerRowToConfig(providerRow);
        const adapter = createAdapter(config);
        return {
          adapter,
          providerName: providerRow.name,
          modelName: routeRow.primary_model,
          providerId: providerRow.id,
        };
      }
    }

    const fallbackChain = (routeRow.fallback_chain ?? []) as FallbackEntry[];
    for (const fallback of fallbackChain) {
      let providerRow: ProviderRow | null = null;
      try {
        providerRow = await fetchProvider(tenantId, fallback.providerId);
      } catch (err) {
        console.warn('[AI Gateway] DB query failed for fallback provider, skipping:', err instanceof Error ? err.message : String(err));
      }
      if (providerRow) {
        const config = providerRowToConfig(providerRow);
        const adapter = createAdapter(config);
        return {
          adapter,
          providerName: providerRow.name,
          modelName: fallback.model,
          providerId: providerRow.id,
        };
      }
    }
  }

  let defaultProvider: ProviderRow | null = null;
  try {
    defaultProvider = await fetchDefaultProvider(tenantId);
  } catch (err) {
    console.warn('[AI Gateway] DB query failed for default provider, falling back to env:', err instanceof Error ? err.message : String(err));
  }
  if (defaultProvider) {
    const config = providerRowToConfig(defaultProvider);
    const adapter = createAdapter(config);
    const modelName = (defaultProvider.models?.[0] as string) ?? aiConfig.defaultModel;
    return {
      adapter,
      providerName: defaultProvider.name,
      modelName,
      providerId: defaultProvider.id,
    };
  }

  const config: ProviderConfig = {
    id: 'env-default',
    name: aiConfig.defaultProvider,
    kind: 'openai_compatible',
    baseUrl: aiConfig.baseUrl ?? 'https://api.openai-next.com/v1',
    apiKey: aiConfig.apiKey ?? null,
    models: [aiConfig.defaultModel],
    capabilities: ['chat'],
    priority: 100,
  };
  const adapter = createAdapter(config);
  return {
    adapter,
    providerName: config.name,
    modelName: aiConfig.defaultModel,
    providerId: config.id,
  };
}

export async function getFallbackChain(
  tenantId: string,
  taskType: string = 'chat',
): Promise<FallbackEntry[]> {
  try {
    const routeRow = await fetchRouteConfig(tenantId, taskType);
    if (!routeRow) return [];
    return (routeRow.fallback_chain ?? []) as FallbackEntry[];
  } catch (err) {
    console.warn('[AI Gateway] DB query failed for fallback chain, returning empty:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

export class GatewayError extends Error {
  readonly code: number;
  constructor(message: string, code: number = ErrorCode.AI_SERVICE_UNAVAILABLE) {
    super(message);
    this.code = code;
  }
}

export async function recordUsage(params: {
  tenantId: string;
  provider: string;
  model: string;
  purpose: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  latencyMs: number;
  runId?: string;
}): Promise<void> {
  try {
    const db = getSupabaseClient();
    await db.from('ai_model_usage').insert({
      id: crypto.randomUUID(),
      tenant_id: params.tenantId,
      run_id: params.runId ?? null,
      provider: params.provider,
      model: params.model,
      purpose: params.purpose,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      cost: params.cost,
      latency_ms: params.latencyMs,
    });
  } catch (err) {
    console.warn('[AI Gateway] recordUsage failed, skipping:', err instanceof Error ? err.message : String(err));
  }
}

export async function chatWithFallback(params: {
  tenantId: string;
  taskType?: string;
  chatParams: ChatParams;
}): Promise<ChatResult> {
  const { tenantId, chatParams } = params;
  const taskType = params.taskType ?? 'chat';

  const primary = await routeModel(tenantId, taskType);
  const fallbackChain = await getFallbackChain(tenantId, taskType);

  const sanitizedMessages = sanitizeMessages(chatParams.messages);
  const sanitizedParams: ChatParams = { ...chatParams, messages: sanitizedMessages };

  const attempts: Array<{ providerId: string; model: string }> = [
    { providerId: primary.providerId, model: primary.modelName },
    ...fallbackChain,
  ];

  let lastError: Error | null = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    let adapter: ProviderAdapter;
    let providerName: string;

    if (i === 0) {
      adapter = primary.adapter;
      providerName = primary.providerName;
    } else {
      let providerRow: ProviderRow | null = null;
      try {
        providerRow = await fetchProvider(tenantId, attempt.providerId);
      } catch (err) {
        console.warn('[AI Gateway] DB query failed for fallback provider, skipping:', err instanceof Error ? err.message : String(err));
      }
      if (!providerRow) continue;
      const config = providerRowToConfig(providerRow);
      adapter = createAdapter(config);
      providerName = providerRow.name;
    }

    try {
      const startTime = Date.now();
      const result = await adapter.chat(sanitizedParams);
      const latencyMs = Date.now() - startTime;

      await recordUsage({
        tenantId,
        provider: providerName,
        model: attempt.model,
        purpose: taskType,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        cost: result.totalTokens,
        latencyMs,
      });

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const errMsg = lastError.message.toLowerCase();
      if (errMsg.includes('401') || errMsg.includes('unauthorized') || errMsg.includes('api key')) {
        throw new GatewayError('AI 服务认证失败，请检查 API Key 配置', ErrorCode.AI_AUTH_FAILED);
      }
      if (errMsg.includes('404') || errMsg.includes('model not found') || errMsg.includes('does not exist')) {
        throw new GatewayError('模型不存在，请检查模型配置', ErrorCode.AI_MODEL_NOT_FOUND);
      }
      if (errMsg.includes('timeout') || errMsg.includes('timed out')) {
        throw new GatewayError('AI 服务响应超时', ErrorCode.AI_TIMEOUT);
      }

      if (i === 0 && attempts.length > 1) {
        try {
          const startTime = Date.now();
          const result = await adapter.chat(sanitizedParams);
          const latencyMs = Date.now() - startTime;

          await recordUsage({
            tenantId,
            provider: providerName,
            model: attempt.model,
            purpose: taskType,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            cost: result.totalTokens,
            latencyMs,
          });

          return result;
        } catch (retryErr) {
          lastError = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
        }
      }
    }
  }

  throw new GatewayError(
    lastError?.message ?? '所有模型均不可用',
    ErrorCode.AI_SERVICE_UNAVAILABLE,
  );
}

export async function* streamChatWithFallback(params: {
  tenantId: string;
  taskType?: string;
  chatParams: ChatParams;
}): AsyncGenerator<StreamChunk> {
  const { tenantId, chatParams } = params;
  const taskType = params.taskType ?? 'chat';

  const primary = await routeModel(tenantId, taskType);

  const sanitizedMessages = sanitizeMessages(chatParams.messages);
  const sanitizedParams: ChatParams = { ...chatParams, messages: sanitizedMessages };

  const startTime = Date.now();
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  try {
    for await (const chunk of primary.adapter.streamChat(sanitizedParams)) {
      if (chunk.type === 'done') {
        promptTokens = chunk.promptTokens;
        completionTokens = chunk.completionTokens;
        totalTokens = chunk.totalTokens;
      }
      yield chunk;
    }

    const latencyMs = Date.now() - startTime;
    await recordUsage({
      tenantId,
      provider: primary.providerName,
      model: primary.modelName,
      purpose: taskType,
      promptTokens,
      completionTokens,
      cost: totalTokens,
      latencyMs,
    });
  } catch (err) {
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : '流式聊天失败',
    };
  }
}

let gatewayInstance: AIGateway | null = null;

export class AIGateway {
  async chat(params: {
    tenantId: string;
    taskType?: string;
    chatParams: ChatParams;
  }): Promise<ChatResult> {
    return chatWithFallback(params);
  }

  async *streamChat(params: {
    tenantId: string;
    taskType?: string;
    chatParams: ChatParams;
  }): AsyncGenerator<StreamChunk> {
    yield* streamChatWithFallback(params);
  }

  async embed(params: {
    tenantId: string;
    text: string;
    taskType?: string;
  }): Promise<number[]> {
    const route = await routeModel(params.tenantId, params.taskType ?? 'embed');
    const sanitizedText = SENSITIVE_PATTERNS.reduce(
      (content, pattern) => content.replace(pattern.regex, pattern.replacement),
      params.text,
    );

    const startTime = Date.now();
    const embedding = await route.adapter.embed(sanitizedText);
    const latencyMs = Date.now() - startTime;

    await recordUsage({
      tenantId: params.tenantId,
      provider: route.providerName,
      model: route.modelName,
      purpose: 'embed',
      promptTokens: 0,
      completionTokens: 0,
      cost: 0,
      latencyMs,
    });

    return embedding;
  }
}

export function getGateway(): AIGateway {
  if (!gatewayInstance) {
    gatewayInstance = new AIGateway();
  }
  return gatewayInstance;
}