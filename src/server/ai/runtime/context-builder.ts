import { getAgent } from '@/server/ai/agents/registry';
import type { SessionUser } from '@/lib/auth';
import { buildContextForAgent } from '@/server/ai/runtime/memory';
import { listTools } from '@/server/ai/tools/registry';

/* ============================================================
 * 类型定义
 * ============================================================ */

export type ContextPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8';

export type ContextSource =
  | 'SYSTEM_PROMPT'
  | 'TENANT_PROMPT'
  | 'AGENT_PROMPT'
  | 'USER_PROMPT'
  | 'CONVERSATION_HISTORY'
  | 'CONVERSATION_SUMMARY'
  | 'USER_MEMORY'
  | 'TASK_CONTEXT'
  | 'BUSINESS_CONTEXT'
  | 'KNOWLEDGE_CONTEXT'
  | 'TOOL_RESULTS'
  | 'CURRENT_PLAN'
  | 'EXECUTION_STATE';

export type TokenBudget = {
  maxContextTokens: number;
  systemTokenBudget: number;
  userTokenBudget: number;
  memoryTokenBudget: number;
  knowledgeTokenBudget: number;
  historyTokenBudget: number;
  toolResultTokenBudget: number;
  outputTokenBudget: number;
};

export type TokenBreakdown = {
  system: number;
  agent: number;
  user: number;
  history: number;
  memory: number;
  task: number;
  knowledge: number;
  tools: number;
  plan: number;
  total: number;
};

export type AgentContext = {
  systemPrompt: string;
  agentPrompt: string;
  userGoal: string;
  conversationHistory: { role: string; content: string }[];
  conversationSummary: string | null;
  userMemory: string[];
  taskContext: string | null;
  businessContext: string | null;
  knowledgeContext: string[];
  toolResults: Record<string, unknown>[];
  currentPlan: string | null;
  executionState: string | null;
  permissions: string[];
  dataScope: string;
  tokenBreakdown: TokenBreakdown;
};

export type BuildContextParams = {
  agentCode: string;
  runId?: string;
  conversationId?: string;
  userGoal: string;
  tokenBudget?: Partial<TokenBudget>;
  user: SessionUser;
};

/* ============================================================
 * 常量定义
 * ============================================================ */

const DEFAULT_MAX_CONTEXT_TOKENS = 8000;

const PRIORITY_MAP: Record<ContextSource, ContextPriority> = {
  SYSTEM_PROMPT: 'P0',
  TENANT_PROMPT: 'P0',
  AGENT_PROMPT: 'P1',
  USER_PROMPT: 'P2',
  CURRENT_PLAN: 'P2',
  EXECUTION_STATE: 'P2',
  BUSINESS_CONTEXT: 'P3',
  TASK_CONTEXT: 'P3',
  KNOWLEDGE_CONTEXT: 'P4',
  CONVERSATION_HISTORY: 'P5',
  CONVERSATION_SUMMARY: 'P6',
  USER_MEMORY: 'P7',
  TOOL_RESULTS: 'P8',
};

const PRIORITY_ORDER: Record<ContextPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  P5: 5,
  P6: 6,
  P7: 7,
  P8: 8,
};

const BUDGET_RATIOS = {
  system: 0.15,
  agent: 0.10,
  history: 0.20,
  memory: 0.15,
  task: 0.10,
  knowledge: 0.15,
  tools: 0.10,
  output: 0.05,
};

/* ============================================================
 * Token 预算分配
 * ============================================================ */

function calculateBudget(maxTokens: number, overrides?: Partial<TokenBudget>): TokenBudget {
  return {
    maxContextTokens: overrides?.maxContextTokens ?? maxTokens,
    systemTokenBudget: overrides?.systemTokenBudget ?? Math.floor(maxTokens * BUDGET_RATIOS.system),
    userTokenBudget: overrides?.userTokenBudget ?? Math.floor(maxTokens * BUDGET_RATIOS.agent),
    memoryTokenBudget: overrides?.memoryTokenBudget ?? Math.floor(maxTokens * BUDGET_RATIOS.memory),
    knowledgeTokenBudget: overrides?.knowledgeTokenBudget ?? Math.floor(maxTokens * BUDGET_RATIOS.knowledge),
    historyTokenBudget: overrides?.historyTokenBudget ?? Math.floor(maxTokens * BUDGET_RATIOS.history),
    toolResultTokenBudget: overrides?.toolResultTokenBudget ?? Math.floor(maxTokens * BUDGET_RATIOS.tools),
    outputTokenBudget: overrides?.outputTokenBudget ?? Math.floor(maxTokens * BUDGET_RATIOS.output),
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '...[truncated]';
}

/* ============================================================
 * Context 构建核心
 * ============================================================ */

export async function buildContext(params: BuildContextParams): Promise<{
  context: AgentContext;
  tokenUsage: TokenBreakdown;
}> {
  const agent = getAgent(params.agentCode);
  if (!agent) {
    throw new Error(`Agent 不存在: ${params.agentCode}`);
  }

  const budget = calculateBudget(
    params.tokenBudget?.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS,
    params.tokenBudget,
  );

  const systemPrompt = `你是银智通平台的AI助手。必须遵守以下规则：
1. 不得自行提升权限
2. 不得访问越权数据
3. 不得绕过审批流程
4. 不得修改系统配置
5. 不得删除关键数据
6. 不得关闭安全检查
7. 不得泄露敏感信息
8. 不得伪造执行结果
9. 不得擅自对外发送信息`;

  const agentPrompt = `角色: ${agent.role}\n目标: ${agent.goals.join('; ')}\n约束: ${agent.guardrails.join('; ')}`;

  let conversationHistory: { role: string; content: string }[] = [];
  let conversationSummary: string | null = null;
  let userMemory: string[] = [];

  if (params.conversationId) {
    const memoryContext = await buildContextForAgent(
      params.conversationId,
      params.user,
      params.runId,
    );
    conversationHistory = memoryContext.conversationMessages;
    conversationSummary = memoryContext.systemContext || null;
  }

  const availableTools = listTools().filter((t) => {
    return params.user.permissions.includes('*') ||
           params.user.permissions.includes(t.requiredPermission);
  });

  const toolDefinitions = availableTools.slice(0, 10).map((t) =>
    `${t.code}: ${t.description}`,
  );

  const knowledgeContext: string[] = [];

  const taskContext = params.runId ? `当前执行Run: ${params.runId}` : null;
  const businessContext = `当前模块: ${agent.module}`;
  const currentPlan = null;
  const executionState = null;

  let systemTokens = estimateTokens(systemPrompt);
  let agentTokens = estimateTokens(agentPrompt);
  let historyTokens = conversationHistory.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  let memoryTokens = userMemory.reduce((sum, m) => sum + estimateTokens(m), 0);
  let taskTokens = taskContext ? estimateTokens(taskContext) : 0;
  let knowledgeTokens = knowledgeContext.reduce((sum, k) => sum + estimateTokens(k), 0);
  let toolTokens = toolDefinitions.reduce((sum, t) => sum + estimateTokens(t), 0);
  let planTokens = currentPlan ? estimateTokens(currentPlan) : 0;

  if (historyTokens > budget.historyTokenBudget) {
    if (conversationSummary) {
      conversationSummary = truncateToTokens(conversationSummary, budget.historyTokenBudget);
      conversationHistory = [];
      historyTokens = estimateTokens(conversationSummary);
    } else {
      const keptMessages: typeof conversationHistory = [];
      let keptTokens = 0;
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msgTokens = estimateTokens(conversationHistory[i].content);
        if (keptTokens + msgTokens > budget.historyTokenBudget) break;
        keptMessages.unshift(conversationHistory[i]);
        keptTokens += msgTokens;
      }
      conversationHistory = keptMessages;
      historyTokens = keptTokens;
    }
  }

  if (memoryTokens > budget.memoryTokenBudget) {
    const keptMemory: string[] = [];
    let keptTokens = 0;
    for (const mem of userMemory) {
      const memTokens = estimateTokens(mem);
      if (keptTokens + memTokens > budget.memoryTokenBudget) break;
      keptMemory.push(mem);
      keptTokens += memTokens;
    }
    userMemory = keptMemory;
    memoryTokens = keptTokens;
  }

  if (knowledgeTokens > budget.knowledgeTokenBudget) {
    const keptKnowledge: string[] = [];
    let keptTokens = 0;
    for (const k of knowledgeContext) {
      const kTokens = estimateTokens(k);
      if (keptTokens + kTokens > budget.knowledgeTokenBudget) break;
      keptKnowledge.push(k);
      keptTokens += kTokens;
    }
    knowledgeContext.length = 0;
    knowledgeContext.push(...keptKnowledge);
    knowledgeTokens = keptTokens;
  }

  if (toolTokens > budget.toolResultTokenBudget) {
    const keptTools = toolDefinitions.slice(0, 5);
    toolDefinitions.length = 0;
    toolDefinitions.push(...keptTools);
    toolTokens = keptTools.reduce((sum, t) => sum + estimateTokens(t), 0);
  }

  const totalTokens = systemTokens + agentTokens + historyTokens + memoryTokens +
    taskTokens + knowledgeTokens + toolTokens + planTokens;

  const tokenBreakdown: TokenBreakdown = {
    system: systemTokens,
    agent: agentTokens,
    user: estimateTokens(params.userGoal),
    history: historyTokens,
    memory: memoryTokens,
    task: taskTokens,
    knowledge: knowledgeTokens,
    tools: toolTokens,
    plan: planTokens,
    total: totalTokens,
  };

  const context: AgentContext = {
    systemPrompt,
    agentPrompt,
    userGoal: params.userGoal,
    conversationHistory,
    conversationSummary,
    userMemory,
    taskContext,
    businessContext,
    knowledgeContext,
    toolResults: [],
    currentPlan,
    executionState,
    permissions: params.user.permissions,
    dataScope: params.user.dataScope,
    tokenBreakdown,
  };

  return { context, tokenUsage: tokenBreakdown };
}

/* ============================================================
 * Summary 自动生成
 * ============================================================ */

export type ConversationSummary = {
  conversationSummary: string;
  userObjectives: string[];
  decisions: string[];
  constraints: string[];
  completedWork: string[];
  pendingWork: string[];
  referencedObjects: string[];
  importantContext: string[];
};

export function generateConversationSummary(
  messages: { role: string; content: string }[],
): ConversationSummary {
  const userMessages = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  const userObjectives = userMessages
    .map((m) => m.content.slice(0, 100))
    .slice(-5);

  const completedWork = assistantMessages
    .filter((m) => m.content.includes('完成') || m.content.includes('成功'))
    .map((m) => m.content.slice(0, 80))
    .slice(-3);

  const pendingWork = assistantMessages
    .filter((m) => m.content.includes('待') || m.content.includes('需要'))
    .map((m) => m.content.slice(0, 80))
    .slice(-3);

  const summary = `对话包含 ${messages.length} 条消息，用户目标: ${userObjectives.join('; ')}`;

  return {
    conversationSummary: summary,
    userObjectives,
    decisions: [],
    constraints: [],
    completedWork,
    pendingWork,
    referencedObjects: [],
    importantContext: [],
  };
}

/* ============================================================
 * 优先级排序工具
 * ============================================================ */

export function getContextPriority(source: ContextSource): ContextPriority {
  return PRIORITY_MAP[source];
}

export function sortByPriority(sources: ContextSource[]): ContextSourceGroupped[] {
  const groups: Record<ContextPriority, ContextSource[]> = {
    P0: [], P1: [], P2: [], P3: [], P4: [], P5: [], P6: [], P7: [], P8: [],
  };

  for (const source of sources) {
    const priority = PRIORITY_MAP[source];
    groups[priority].push(source);
  }

  return (Object.entries(groups) as [ContextPriority, ContextSource[]][])
    .sort(([a], [b]) => PRIORITY_ORDER[a] - PRIORITY_ORDER[b])
    .map(([priority, items]) => ({ priority, items }));
}

type ContextSourceGroupped = {
  priority: ContextPriority;
  items: ContextSource[];
};