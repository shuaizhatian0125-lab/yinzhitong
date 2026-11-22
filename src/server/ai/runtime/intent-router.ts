import type { AgentDefinition } from '@/server/ai/agents/registry';
import { getAgent, listAgents } from '@/server/ai/agents/registry';
import type { SessionUser } from '@/lib/auth';

/* ============================================================
 * V2 类型定义
 * ============================================================ */

export type PrimaryIntent =
  | 'CHAT'
  | 'KNOWLEDGE'
  | 'SEARCH'
  | 'RESEARCH'
  | 'ANALYSIS'
  | 'DOCUMENT'
  | 'TASK'
  | 'PLAN'
  | 'WORKFLOW'
  | 'ENTERPRISE'
  | 'CUSTOMER'
  | 'MARKETING'
  | 'RISK'
  | 'DATA'
  | 'MANAGEMENT'
  | 'SYSTEM';

export type ComplexityLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export type SecondaryIntent =
  | 'customer_query'
  | 'enterprise_query'
  | 'knowledge_query'
  | 'task_create'
  | 'task_query'
  | 'task_update'
  | 'doc_create'
  | 'doc_query'
  | 'doc_edit'
  | 'research_industry'
  | 'research_enterprise'
  | 'research_policy'
  | 'analysis_metric'
  | 'analysis_multi_dim'
  | 'analysis_anomaly'
  | 'collab_create'
  | 'collab_query'
  | 'workflow_start'
  | 'workflow_query'
  | 'risk_query'
  | 'risk_handle'
  | 'marketing_segment'
  | 'marketing_campaign'
  | 'marketing_effect'
  | 'cockpit_view'
  | 'general_chat';

export type AIIntent = {
  primaryIntent: PrimaryIntent;
  secondaryIntent: SecondaryIntent;
  confidence: number;
  complexity: ComplexityLevel;
  dataDomains: string[];
  suggestedAgents: string[];
};

export type RoutingDecision = {
  intent: AIIntent;
  selectedAgent: string;
  executionPath: 'direct' | 'plan_then_execute';
  requiresConfirmation: boolean;
  confirmationType?: string;
};

export type AgentMatch = {
  agentCode: string;
  score: number;
  matchedIntents: string[];
  matchedCapabilities: string[];
};

/* ============================================================
 * V1 兼容类型（保留向后兼容）
 * ============================================================ */

export type Complexity = 'S1' | 'S2' | 'S3' | 'S4';

export type IntentContext = {
  user: SessionUser;
  conversationId?: string;
  currentModule?: string;
  currentRoute?: string;
  recentMessages?: { role: string; content: string }[];
  clarificationCount?: number;
};

export type IntentRoute = {
  agentCode: string;
  complexity: Complexity;
  plan?: PlanCard;
  needsClarification?: boolean;
  clarificationQuestion?: string;
};

export type PlanCard = {
  goal: string;
  steps: PlanStep[];
  estimatedToolCalls: string[];
  riskLevel: 'L0' | 'L1' | 'L2' | 'L3';
};

type PlanStep = {
  seq: number;
  description: string;
  toolCode?: string;
};

/* ============================================================
 * 意图关键词映射
 * ============================================================ */

const PRIMARY_INTENT_KEYWORDS: Record<PrimaryIntent, string[]> = {
  CHAT: ['你好', '谢谢', '帮忙', '请问', '如何', '什么是', '解释', '说明'],
  KNOWLEDGE: ['知识', '制度', '规章', '政策文件', '产品知识', '案例库', '手册'],
  SEARCH: ['搜索', '查找', '找一下', '检索', '查询', '列出', '看看'],
  RESEARCH: ['研究', '调研', '行业分析', '趋势分析', '产业链', '竞争分析', '政策研究'],
  ANALYSIS: ['分析', '统计', '指标', '数据', '看板', '多维', '归因', '异常'],
  DOCUMENT: ['文档', '报告', '公文', '方案', '起草', '写作', '模板', '周报', '月报'],
  TASK: ['任务', '待办', '计划', '进度', '指派', '分配', '截止', '拆解'],
  PLAN: ['规划', '制定计划', '分解目标', '安排', '排期'],
  WORKFLOW: ['工作流', '流程', '审批流', '自动执行', '批量', '协同', '协作'],
  ENTERPRISE: ['企业', '公司', '画像', '授信', '价值', '产品匹配', '全景', '科技企业'],
  CUSTOMER: ['客户', '拜访', '商机', '漏斗', '360', '关系', '流失', '客户经理'],
  MARKETING: ['营销', '客群', '活动', '推广', '效果', '转化', '圈选'],
  RISK: ['风险', '预警', '合规', '处置', '规则', '整改', '告警'],
  DATA: ['数据', '报表', '导出', '下载', '上传', '文件'],
  MANAGEMENT: ['管理', '配置', '设置', '用户', '角色', '权限', '审计'],
  SYSTEM: ['系统', '健康', '状态', '版本', '日志'],
};

const MODULE_AGENT_MAP: Record<string, string> = {
  workbench: 'assistant',
  task: 'task_planner',
  office: 'doc_writer',
  research: 'research_analyst',
  enterprise: 'enterprise_insight',
  customer: 'customer_advisor',
  risk: 'risk_analyst',
  analytics: 'analytics_analyst',
  knowledge: 'knowledge_qa',
  cockpit: 'cockpit_briefer',
  collab: 'collab_coordinator',
  marketing: 'marketing_advisor',
};

const COMPLEXITY_INDICATORS: Record<ComplexityLevel, string[]> = {
  L4: ['工作流', '流程编排', '自动执行', '批量', '跨部门协作', '全流程'],
  L3: ['计划', '方案', '详细', '完整', '报告', '调研', '分析报告', '研究'],
  L2: ['查询', '查看', '列出', '搜索', '找', '统计', '创建', '生成'],
  L1: ['什么是', '解释', '说明', '简单', '快速', '直接', '帮我看看'],
  L0: ['你好', '谢谢', '再见'],
};

const CONFIRMATION_REQUIRED_INTENTS: PrimaryIntent[] = ['WORKFLOW', 'PLAN', 'MARKETING'];

/* ============================================================
 * V2 核心算法
 * ============================================================ */

function classifyPrimaryIntent(input: string): PrimaryIntent {
  const lowerInput = input.toLowerCase();
  let bestMatch: PrimaryIntent = 'CHAT';
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(PRIMARY_INTENT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = intent as PrimaryIntent;
    }
  }

  return bestMatch;
}

function classifySecondaryIntent(input: string, primary: PrimaryIntent): SecondaryIntent {
  const lowerInput = input.toLowerCase();

  if (primary === 'CUSTOMER') return 'customer_query';
  if (primary === 'ENTERPRISE') {
    if (lowerInput.includes('研究') || lowerInput.includes('分析')) return 'research_enterprise';
    return 'enterprise_query';
  }
  if (primary === 'KNOWLEDGE') return 'knowledge_query';
  if (primary === 'TASK') {
    if (lowerInput.includes('创建') || lowerInput.includes('新建')) return 'task_create';
    if (lowerInput.includes('更新') || lowerInput.includes('修改')) return 'task_update';
    return 'task_query';
  }
  if (primary === 'DOCUMENT') {
    if (lowerInput.includes('创建') || lowerInput.includes('起草') || lowerInput.includes('生成')) return 'doc_create';
    if (lowerInput.includes('编辑') || lowerInput.includes('修改')) return 'doc_edit';
    return 'doc_query';
  }
  if (primary === 'RESEARCH') {
    if (lowerInput.includes('行业')) return 'research_industry';
    if (lowerInput.includes('政策')) return 'research_policy';
    return 'research_enterprise';
  }
  if (primary === 'ANALYSIS') {
    if (lowerInput.includes('多维')) return 'analysis_multi_dim';
    if (lowerInput.includes('异常') || lowerInput.includes('归因')) return 'analysis_anomaly';
    return 'analysis_metric';
  }
  if (primary === 'WORKFLOW') {
    if (lowerInput.includes('查询') || lowerInput.includes('查看')) return 'workflow_query';
    return 'workflow_start';
  }
  if (primary === 'RISK') {
    if (lowerInput.includes('处置') || lowerInput.includes('处理')) return 'risk_handle';
    return 'risk_query';
  }
  if (primary === 'MARKETING') {
    if (lowerInput.includes('效果') || lowerInput.includes('ROI') || lowerInput.includes('转化率')) return 'marketing_effect';
    if (lowerInput.includes('活动') || lowerInput.includes('推广')) return 'marketing_campaign';
    return 'marketing_segment';
  }
  if (primary === 'MANAGEMENT') return 'cockpit_view';

  return 'general_chat';
}

function classifyComplexityV2(input: string): ComplexityLevel {
  for (const [level, indicators] of Object.entries(COMPLEXITY_INDICATORS)) {
    for (const indicator of indicators) {
      if (input.includes(indicator)) {
        return level as ComplexityLevel;
      }
    }
  }

  if (input.length > 150) return 'L3';
  if (input.length > 50) return 'L2';
  if (input.length > 15) return 'L1';
  return 'L0';
}

function calculateConfidence(
  input: string,
  primaryIntent: PrimaryIntent,
  matchedKeywords: number,
  context?: IntentContext,
): number {
  const matchScore = Math.min(matchedKeywords * 0.15, 0.4);

  let contextScore = 0.3;
  if (context?.currentModule && context.currentModule !== 'workbench') {
    const moduleIntentMap: Record<string, PrimaryIntent> = {
      task: 'TASK',
      office: 'DOCUMENT',
      research: 'RESEARCH',
      enterprise: 'ENTERPRISE',
      customer: 'CUSTOMER',
      risk: 'RISK',
      analytics: 'ANALYSIS',
      knowledge: 'KNOWLEDGE',
      cockpit: 'MANAGEMENT',
      collab: 'WORKFLOW',
    };
    const moduleIntent = moduleIntentMap[context.currentModule];
    if (moduleIntent === primaryIntent) {
      contextScore = 0.3;
    } else {
      contextScore = 0.1;
    }
  }

  let historyScore = 0.3;
  if (context?.recentMessages && context.recentMessages.length > 0) {
    const recentContent = context.recentMessages.map((m) => m.content).join(' ');
    const recentKeywords = PRIMARY_INTENT_KEYWORDS[primaryIntent];
    const hasRecentMatch = recentKeywords.some((kw) => recentContent.includes(kw));
    if (!hasRecentMatch) {
      historyScore = 0.15;
    }
  }

  return Math.min(matchScore + contextScore + historyScore, 1.0);
}

function matchAgents(intent: AIIntent, user: SessionUser): AgentMatch[] {
  const allAgents = listAgents();
  const matches: AgentMatch[] = [];

  for (const agent of allAgents) {
    if (agent.status && agent.status !== 'active') continue;
    if (!checkPermission(user, agent)) continue;

    const supportedIntents = (agent.definition as Record<string, unknown>)?.supportedIntents as string[] | undefined;
    const capabilities = (agent.definition as Record<string, unknown>)?.capabilities as string[] | undefined;

    let intentMatchScore = 0;
    const matchedIntents: string[] = [];
    if (supportedIntents) {
      for (const si of supportedIntents) {
        if (si === intent.primaryIntent || si === intent.secondaryIntent) {
          intentMatchScore += 0.3;
          matchedIntents.push(si);
        }
      }
    }

    let capabilityScore = 0;
    const matchedCapabilities: string[] = [];
    if (capabilities) {
      for (const cap of capabilities) {
        if (intent.dataDomains.includes(cap)) {
          capabilityScore += 0.3;
          matchedCapabilities.push(cap);
        }
      }
    }

    const riskCompatScore = 0.2;
    const modelAffinityScore = 0.2;

    const totalScore = Math.min(
      intentMatchScore + capabilityScore + riskCompatScore + modelAffinityScore,
      1.0,
    );

    if (totalScore > 0) {
      matches.push({
        agentCode: agent.code,
        score: totalScore,
        matchedIntents,
        matchedCapabilities,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

function checkPermission(user: SessionUser, agent: AgentDefinition): boolean {
  if (agent.riskLevel === 'L0') return true;

  const modulePermMap: Record<string, string> = {
    task: 'task.view',
    office: 'office.view',
    research: 'research.view',
    enterprise: 'enterprise.view',
    customer: 'customer.view',
    risk: 'risk.view',
    analytics: 'analytics.view',
    knowledge: 'knowledge.view',
    cockpit: 'cockpit.view',
    collab: 'collab.view',
    marketing: 'marketing.view',
  };

  const requiredPerm = modulePermMap[agent.module];
  if (!requiredPerm) return true;

  return user.permissions.includes('*') || user.permissions.includes(requiredPerm);
}

/* ============================================================
 * V2 主入口函数
 * ============================================================ */

export function routeIntentV2(input: string, context: IntentContext): RoutingDecision {
  const primaryIntent = classifyPrimaryIntent(input);
  const secondaryIntent = classifySecondaryIntent(input, primaryIntent);
  const complexity = classifyComplexityV2(input);

  const keywords = PRIMARY_INTENT_KEYWORDS[primaryIntent];
  let matchedKeywordCount = 0;
  const lowerInput = input.toLowerCase();
  for (const kw of keywords) {
    if (lowerInput.includes(kw.toLowerCase())) {
      matchedKeywordCount++;
    }
  }

  const confidence = calculateConfidence(input, primaryIntent, matchedKeywordCount, context);

  const domainMap: Record<PrimaryIntent, string[]> = {
    CHAT: [],
    KNOWLEDGE: ['knowledge'],
    SEARCH: ['search'],
    RESEARCH: ['research', 'industry'],
    ANALYSIS: ['analytics', 'data'],
    DOCUMENT: ['document', 'office'],
    TASK: ['task'],
    PLAN: ['task', 'plan'],
    WORKFLOW: ['workflow', 'collab'],
    ENTERPRISE: ['enterprise'],
    CUSTOMER: ['customer'],
    MARKETING: ['marketing'],
    RISK: ['risk'],
    DATA: ['data', 'file'],
    MANAGEMENT: ['admin'],
    SYSTEM: ['system'],
  };
  const dataDomains = domainMap[primaryIntent] || [];

  const agentMatches = matchAgents(
    { primaryIntent, secondaryIntent, confidence, complexity, dataDomains, suggestedAgents: [] },
    context.user,
  );

  const selectedAgent = agentMatches[0]?.agentCode ?? 'assistant';
  const requiresConfirmation = CONFIRMATION_REQUIRED_INTENTS.includes(primaryIntent) && (complexity === 'L3' || complexity === 'L4');
  const executionPath: 'direct' | 'plan_then_execute' =
    complexity === 'L3' || complexity === 'L4' ? 'plan_then_execute' : 'direct';

  return {
    intent: {
      primaryIntent,
      secondaryIntent,
      confidence,
      complexity,
      dataDomains,
      suggestedAgents: agentMatches.map((m) => m.agentCode),
    },
    selectedAgent,
    executionPath,
    requiresConfirmation,
    confirmationType: requiresConfirmation ? 'PLAN_CONFIRMATION' : undefined,
  };
}

/* ============================================================
 * V1 兼容入口（保留向后兼容）
 * ============================================================ */

function classifyDomain(input: string): string[] {
  const matchedDomains: string[] = [];
  const lowerInput = input.toLowerCase();

  const DOMAIN_KEYWORDS_COMPAT: Record<string, string[]> = {
    task: ['任务', '待办', '计划', '进度', '指派', '分配', 'deadline', '截止'],
    office: ['文档', '报告', '公文', '方案', '起草', '写作', '模板'],
    research: ['行业', '趋势', '政策', '竞争', '产业链', '研究', '分析'],
    enterprise: ['企业', '公司', '画像', '授信', '价值', '产品匹配', '全景'],
    customer: ['客户', '拜访', '商机', '漏斗', '360', '关系', '流失'],
    risk: ['风险', '预警', '合规', '处置', '规则', '整改', '告警'],
    analytics: ['指标', '数据', '分析', '看板', '多维', '归因', '统计'],
    knowledge: ['知识', '制度', '问答', '检索', '案例', '产品知识'],
    cockpit: ['驾驶舱', '简报', '全景', '督办', '管理层', '总览'],
    collab: ['协作', '协同', '项目', '跨部门', '审批', '议题'],
  };

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS_COMPAT)) {
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        if (!matchedDomains.includes(domain)) {
          matchedDomains.push(domain);
        }
        break;
      }
    }
  }

  return matchedDomains;
}

function classifyComplexity(input: string): Complexity {
  const v2Level = classifyComplexityV2(input);
  const mapping: Record<ComplexityLevel, Complexity> = {
    L0: 'S1',
    L1: 'S1',
    L2: 'S2',
    L3: 'S3',
    L4: 'S4',
  };
  return mapping[v2Level];
}

export function routeIntent(input: string, context: IntentContext): IntentRoute {
  const v2Result = routeIntentV2(input, context);

  if (v2Result.intent.confidence < 0.65) {
    const clarificationCount = context.clarificationCount ?? 0;
    if (clarificationCount < 2) {
      return {
        agentCode: 'assistant',
        complexity: 'S1',
        needsClarification: true,
        clarificationQuestion: '我需要更多信息来帮助您。请问您想完成什么任务？例如：创建任务、查询数据、生成报告等。',
      };
    }
  }

  const complexity = classifyComplexity(input);
  const agent = getAgent(v2Result.selectedAgent);

  return {
    agentCode: v2Result.selectedAgent,
    complexity,
    plan: complexity === 'S3' || complexity === 'S4' ? buildPlanCard(agent!, input) : undefined,
  };
}

function buildPlanCard(agent: AgentDefinition, userGoal: string): PlanCard {
  const steps: PlanStep[] = [];
  const toolCalls: string[] = [];

  for (let i = 0; i < agent.tools.length && i < 5; i++) {
    const toolCode = agent.tools[i];
    steps.push({ seq: i + 1, description: `调用 ${toolCode} 工具执行相关操作`, toolCode });
    toolCalls.push(toolCode);
  }

  if (steps.length === 0) {
    steps.push({ seq: 1, description: '分析用户需求并生成回答' });
  }

  return {
    goal: userGoal,
    steps,
    estimatedToolCalls: toolCalls,
    riskLevel: agent.riskLevel as 'L0' | 'L1' | 'L2' | 'L3',
  };
}

export function getAvailableAgents(user: SessionUser): AgentDefinition[] {
  return listAgents().filter((agent) => checkPermission(user, agent));
}