'use client';

import * as React from 'react';
import { Brain, ArrowRight, Gauge } from 'lucide-react';

type IntentViewProps = {
  intent: string;
  confidence: number;
  complexity: string;
  routingDecision?: string;
  matchedAgent?: string;
  className?: string;
};

const INTENT_LABELS: Record<string, string> = {
  SEARCH: '搜索',
  ANALYZE: '分析',
  CREATE: '创建',
  MODIFY: '修改',
  DELETE: '删除',
  APPROVE: '审批',
  REPORT: '报告',
  PLAN: '规划',
  COLLABORATE: '协作',
  RESEARCH: '研究',
  REVIEW: '评审',
  NOTIFY: '通知',
  CALCULATE: '计算',
  TRANSLATE: '翻译',
  SUMMARIZE: '总结',
  OTHER: '其他',
};

const COMPLEXITY_LABELS: Record<string, string> = {
  L0: 'L0 · 简单',
  L1: 'L1 · 常规',
  L2: 'L2 · 中等',
  L3: 'L3 · 复杂',
  L4: 'L4 · 极复杂',
};

const COMPLEXITY_COLORS: Record<string, string> = {
  L0: 'var(--bz-ok)',
  L1: 'var(--bz-info)',
  L2: 'var(--bz-gold)',
  L3: 'var(--bz-warning)',
  L4: 'var(--bz-danger)',
};

export function IntentView({
  intent,
  confidence,
  complexity,
  routingDecision,
  matchedAgent,
  className,
}: IntentViewProps) {
  const confidencePercent = Math.round(confidence * 100);
  const confidenceColor = confidence >= 0.8 ? 'var(--bz-ok)' : confidence >= 0.5 ? 'var(--bz-gold)' : 'var(--bz-danger)';

  return (
    <div
      className="rounded-[4px] border border-[var(--bz-border)] bg-[var(--bz-card)] p-4"
      style={{ gap: '5px' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Brain className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
        <span className="text-[14px] font-semibold text-[var(--bz-text)]">意图识别</span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-[2px] px-2 py-0.5 text-[12px] font-medium"
            style={{ backgroundColor: 'var(--bz-brand)', color: '#fff' }}
          >
            {INTENT_LABELS[intent] ?? intent}
          </span>
          <span
            className="text-[12px] font-medium"
            style={{ color: COMPLEXITY_COLORS[complexity] ?? 'var(--bz-text-sub)' }}
          >
            {COMPLEXITY_LABELS[complexity] ?? complexity}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Gauge className="h-3.5 w-3.5" style={{ color: confidenceColor }} />
          <span className="text-[12px] font-medium" style={{ color: confidenceColor }}>
            {confidencePercent}%
          </span>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-[var(--bz-bg-sub)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${confidencePercent}%`, backgroundColor: confidenceColor }}
        />
      </div>

      {routingDecision && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--bz-text-sub)]">
          <ArrowRight className="h-3 w-3" />
          <span>路由决策: {routingDecision}</span>
        </div>
      )}

      {matchedAgent && (
        <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--bz-text-sub)]">
          <ArrowRight className="h-3 w-3" />
          <span>匹配 Agent: {matchedAgent}</span>
        </div>
      )}
    </div>
  );
}