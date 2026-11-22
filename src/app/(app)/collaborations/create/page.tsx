'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2, ArrowRight, ArrowLeft, Check, Sparkles,
  Target, Users, ListTodo, Shield, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type WizardStep = 'goal' | 'organization' | 'workplan' | 'rules' | 'risks' | 'confirm';

const STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'goal', label: '协作目标', icon: <Target className="h-4 w-4" /> },
  { key: 'organization', label: '组织结构', icon: <Users className="h-4 w-4" /> },
  { key: 'workplan', label: '工作计划', icon: <ListTodo className="h-4 w-4" /> },
  { key: 'rules', label: '协作规则', icon: <Shield className="h-4 w-4" /> },
  { key: 'risks', label: '风险预案', icon: <AlertCircle className="h-4 w-4" /> },
  { key: 'confirm', label: '确认创建', icon: <Check className="h-4 w-4" /> },
];

type CollaborationDraft = {
  goal: string;
  description: string;
  type: string;
  participants: { name: string; role: string; type: string }[];
  workstreams: { name: string; owner: string; deliverables: string }[];
  rules: { decisionMaker: string; escalationPath: string; meetingCadence: string };
  risks: { description: string; mitigation: string; severity: string }[];
};

export default function CreateCollaborationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = React.useState<WizardStep>('goal');
  const [generating, setGenerating] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<CollaborationDraft>({
    goal: searchParams.get('title') ?? '',
    description: '',
    type: searchParams.get('template') ?? 'project',
    participants: [],
    workstreams: [],
    rules: { decisionMaker: '', escalationPath: '', meetingCadence: 'weekly' },
    risks: [],
  });

  const currentStepIdx = STEPS.findIndex((s) => s.key === currentStep);

  const handleAIGenerate = async () => {
    if (!draft.goal.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/v1/collaborations/builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: draft.goal, type: draft.type }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setDraft((prev) => ({
          ...prev,
          description: json.data.description ?? prev.description,
          participants: json.data.participants ?? [],
          workstreams: json.data.workstreams ?? [],
          rules: json.data.rules ?? prev.rules,
          risks: json.data.risks ?? [],
        }));
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/v1/collaborations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.goal,
          description: draft.description,
          type: draft.type,
          draft,
        }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.id) {
        router.push(`/collaborations/${json.data.id}`);
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const goNext = () => {
    const nextIdx = currentStepIdx + 1;
    if (nextIdx < STEPS.length) setCurrentStep(STEPS[nextIdx].key);
  };

  const goPrev = () => {
    const prevIdx = currentStepIdx - 1;
    if (prevIdx >= 0) setCurrentStep(STEPS[prevIdx].key);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="创建协作"
        description="AI 辅助生成协作方案，逐步确认后创建"
        actions={
          <button
            className="bz-btn bz-btn-ghost"
            style={{ borderRadius: 3 }}
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
        }
      />

      <div className="bz-card" style={{ borderRadius: 8 }}>
        <div className="flex items-center justify-between p-3">
          {STEPS.map((step, idx) => {
            const isActive = step.key === currentStep;
            const isDone = idx < currentStepIdx;

            return (
              <React.Fragment key={step.key}>
                <button
                  onClick={() => setCurrentStep(step.key)}
                  className="flex items-center gap-2 px-2 py-1 rounded transition-colors"
                  style={{
                    borderRadius: 2,
                    background: isActive ? 'var(--bz-brand-tint)' : 'transparent',
                  }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded"
                    style={{
                      borderRadius: 3,
                      background: isDone ? 'var(--bz-ok)' : isActive ? 'var(--bz-brand)' : 'var(--bz-border)',
                      color: isDone || isActive ? '#fff' : 'var(--bz-text-muted)',
                    }}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span
                    className="text-[12px]"
                    style={{ color: isActive ? 'var(--bz-brand)' : 'var(--bz-text-sub)', fontWeight: isActive ? 600 : 400 }}
                  >
                    {step.label}
                  </span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div className="h-px flex-1" style={{ background: idx < currentStepIdx ? 'var(--bz-ok)' : 'var(--bz-border)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="bz-card" style={{ borderRadius: 8 }}>
        {currentStep === 'goal' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold text-[var(--bz-text)]">协作目标</span>
              <button
                onClick={handleAIGenerate}
                disabled={generating || !draft.goal.trim()}
                className="bz-btn bz-btn-primary text-[12px] flex items-center gap-1"
                style={{ borderRadius: 2 }}
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI 生成方案
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="输入协作目标，如：Q4经营分析跨部门协作"
                value={draft.goal}
                onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
              />
              <textarea
                placeholder="协作描述（AI生成后可修改）"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3, minHeight: 80 }}
              />
              <select
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              >
                <option value="project">项目协作</option>
                <option value="task">任务协作</option>
                <option value="meeting">会议协作</option>
                <option value="review">评审协作</option>
                <option value="cross_dept">跨部门协作</option>
                <option value="customer">客户协作</option>
                <option value="compliance">合规协作</option>
              </select>
            </div>
          </div>
        )}

        {currentStep === 'organization' && (
          <div className="p-4">
            <span className="text-[14px] font-semibold text-[var(--bz-text)] mb-3 block">组织结构</span>
            {draft.participants.length === 0 && (
              <div className="text-[13px] text-[var(--bz-text-muted)] py-4 text-center">
                请先在"协作目标"步骤点击 AI 生成方案
              </div>
            )}
            {draft.participants.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  placeholder="姓名/角色"
                  value={p.name}
                  onChange={(e) => {
                    const next = [...draft.participants];
                    next[idx] = { ...p, name: e.target.value };
                    setDraft({ ...draft, participants: next });
                  }}
                  className="text-[13px] px-2 py-1.5 rounded border flex-1"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                />
                <select
                  className="text-[13px] px-2 py-1.5 rounded border"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                  value={p.role}
                  onChange={(e) => {
                    const next = [...draft.participants];
                    next[idx] = { ...p, role: e.target.value };
                    setDraft({ ...draft, participants: next });
                  }}
                >
                  <option value="coordinator">协调者</option>
                  <option value="contributor">贡献者</option>
                  <option value="reviewer">评审者</option>
                  <option value="approver">审批者</option>
                  <option value="observer">观察者</option>
                </select>
                <select
                  className="text-[13px] px-2 py-1.5 rounded border"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                  value={p.type}
                  onChange={(e) => {
                    const next = [...draft.participants];
                    next[idx] = { ...p, type: e.target.value };
                    setDraft({ ...draft, participants: next });
                  }}
                >
                  <option value="human">人员</option>
                  <option value="ai_agent">AI Agent</option>
                </select>
                <button
                  onClick={() => {
                    const next = draft.participants.filter((_, i) => i !== idx);
                    setDraft({ ...draft, participants: next });
                  }}
                  className="text-[12px] text-[var(--bz-danger)] px-1"
                >
                  删除
                </button>
              </div>
            ))}
            <button
              onClick={() => setDraft({
                ...draft,
                participants: [...draft.participants, { name: '', role: 'contributor', type: 'human' }],
              })}
              className="text-[12px] text-[var(--bz-brand)] mt-2"
            >
              + 添加参与者
            </button>
          </div>
        )}

        {currentStep === 'workplan' && (
          <div className="p-4">
            <span className="text-[14px] font-semibold text-[var(--bz-text)] mb-3 block">工作计划</span>
            {draft.workstreams.length === 0 && (
              <div className="text-[13px] text-[var(--bz-text-muted)] py-4 text-center">
                请先在"协作目标"步骤点击 AI 生成方案
              </div>
            )}
            {draft.workstreams.map((w, idx) => (
              <div key={idx} className="rounded border px-3 py-2 mb-2" style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}>
                <input
                  type="text"
                  placeholder="工作线名称"
                  value={w.name}
                  onChange={(e) => {
                    const next = [...draft.workstreams];
                    next[idx] = { ...w, name: e.target.value };
                    setDraft({ ...draft, workstreams: next });
                  }}
                  className="text-[13px] px-2 py-1 rounded border w-full mb-1"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="负责人"
                    value={w.owner}
                    onChange={(e) => {
                      const next = [...draft.workstreams];
                      next[idx] = { ...w, owner: e.target.value };
                      setDraft({ ...draft, workstreams: next });
                    }}
                    className="text-[12px] px-2 py-1 rounded border flex-1"
                    style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                  />
                  <input
                    type="text"
                    placeholder="交付物"
                    value={w.deliverables}
                    onChange={(e) => {
                      const next = [...draft.workstreams];
                      next[idx] = { ...w, deliverables: e.target.value };
                      setDraft({ ...draft, workstreams: next });
                    }}
                    className="text-[12px] px-2 py-1 rounded border flex-1"
                    style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => setDraft({
                ...draft,
                workstreams: [...draft.workstreams, { name: '', owner: '', deliverables: '' }],
              })}
              className="text-[12px] text-[var(--bz-brand)] mt-2"
            >
              + 添加工作线
            </button>
          </div>
        )}

        {currentStep === 'rules' && (
          <div className="p-4">
            <span className="text-[14px] font-semibold text-[var(--bz-text)] mb-3 block">协作规则</span>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] text-[var(--bz-text-sub)] mb-1 block">决策者</label>
                <input
                  type="text"
                  placeholder="谁来做最终决策"
                  value={draft.rules.decisionMaker}
                  onChange={(e) => setDraft({ ...draft, rules: { ...draft.rules, decisionMaker: e.target.value } })}
                  className="text-[13px] px-3 py-2 rounded border w-full"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                />
              </div>
              <div>
                <label className="text-[12px] text-[var(--bz-text-sub)] mb-1 block">升级路径</label>
                <input
                  type="text"
                  placeholder="冲突升级到谁"
                  value={draft.rules.escalationPath}
                  onChange={(e) => setDraft({ ...draft, rules: { ...draft.rules, escalationPath: e.target.value } })}
                  className="text-[13px] px-3 py-2 rounded border w-full"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                />
              </div>
              <div>
                <label className="text-[12px] text-[var(--bz-text-sub)] mb-1 block">会议频率</label>
                <select
                  className="text-[13px] px-3 py-2 rounded border w-full"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                  value={draft.rules.meetingCadence}
                  onChange={(e) => setDraft({ ...draft, rules: { ...draft.rules, meetingCadence: e.target.value } })}
                >
                  <option value="daily">每日</option>
                  <option value="weekly">每周</option>
                  <option value="biweekly">双周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'risks' && (
          <div className="p-4">
            <span className="text-[14px] font-semibold text-[var(--bz-text)] mb-3 block">风险预案</span>
            {draft.risks.length === 0 && (
              <div className="text-[13px] text-[var(--bz-text-muted)] py-4 text-center">
                请先在"协作目标"步骤点击 AI 生成方案
              </div>
            )}
            {draft.risks.map((r, idx) => (
              <div key={idx} className="rounded border px-3 py-2 mb-2" style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}>
                <input
                  type="text"
                  placeholder="风险描述"
                  value={r.description}
                  onChange={(e) => {
                    const next = [...draft.risks];
                    next[idx] = { ...r, description: e.target.value };
                    setDraft({ ...draft, risks: next });
                  }}
                  className="text-[13px] px-2 py-1 rounded border w-full mb-1"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="缓解措施"
                    value={r.mitigation}
                    onChange={(e) => {
                      const next = [...draft.risks];
                      next[idx] = { ...r, mitigation: e.target.value };
                      setDraft({ ...draft, risks: next });
                    }}
                    className="text-[12px] px-2 py-1 rounded border flex-1"
                    style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                  />
                  <select
                    className="text-[12px] px-2 py-1 rounded border"
                    style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}
                    value={r.severity}
                    onChange={(e) => {
                      const next = [...draft.risks];
                      next[idx] = { ...r, severity: e.target.value };
                      setDraft({ ...draft, risks: next });
                    }}
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
              </div>
            ))}
            <button
              onClick={() => setDraft({
                ...draft,
                risks: [...draft.risks, { description: '', mitigation: '', severity: 'medium' }],
              })}
              className="text-[12px] text-[var(--bz-brand)] mt-2"
            >
              + 添加风险
            </button>
          </div>
        )}

        {currentStep === 'confirm' && (
          <div className="p-4">
            <span className="text-[14px] font-semibold text-[var(--bz-text)] mb-3 block">确认创建协作</span>
            <div className="space-y-3">
              <div className="rounded border px-3 py-2" style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}>
                <div className="text-[12px] text-[var(--bz-text-sub)] mb-0.5">协作目标</div>
                <div className="text-[14px] font-medium text-[var(--bz-text)]">{draft.goal}</div>
                {draft.description && <div className="text-[12px] text-[var(--bz-text-sub)] mt-1">{draft.description}</div>}
              </div>
              <div className="rounded border px-3 py-2" style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}>
                <div className="text-[12px] text-[var(--bz-text-sub)] mb-0.5">参与者 ({draft.participants.length})</div>
                {draft.participants.map((p, idx) => (
                  <div key={idx} className="text-[13px] text-[var(--bz-text)]">
                    {p.name} - {p.role} ({p.type === 'human' ? '人员' : 'AI Agent'})
                  </div>
                ))}
              </div>
              <div className="rounded border px-3 py-2" style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}>
                <div className="text-[12px] text-[var(--bz-text-sub)] mb-0.5">工作线 ({draft.workstreams.length})</div>
                {draft.workstreams.map((w, idx) => (
                  <div key={idx} className="text-[13px] text-[var(--bz-text)]">
                    {w.name} - 负责人: {w.owner} - 交付: {w.deliverables}
                  </div>
                ))}
              </div>
              <div className="rounded border px-3 py-2" style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}>
                <div className="text-[12px] text-[var(--bz-text-sub)] mb-0.5">协作规则</div>
                <div className="text-[13px] text-[var(--bz-text)]">
                  决策者: {draft.rules.decisionMaker || '-'} | 升级: {draft.rules.escalationPath || '-'} | 频率: {draft.rules.meetingCadence}
                </div>
              </div>
              <div className="rounded border px-3 py-2" style={{ borderColor: 'var(--bz-border)', borderRadius: 2 }}>
                <div className="text-[12px] text-[var(--bz-text-sub)] mb-0.5">风险预案 ({draft.risks.length})</div>
                {draft.risks.map((r, idx) => (
                  <div key={idx} className="text-[13px] text-[var(--bz-text)]">
                    {r.description} - {r.severity} - {r.mitigation}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={handleCreate}
                disabled={creating || !draft.goal.trim()}
                className="bz-btn bz-btn-primary"
                style={{ borderRadius: 3 }}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {creating ? '创建中...' : '确认创建'}
              </button>
            </div>
          </div>
        )}

        {currentStep !== 'confirm' && (
          <div className="flex items-center justify-between p-3 border-t" style={{ borderColor: 'var(--bz-border)' }}>
            <button
              onClick={goPrev}
              disabled={currentStepIdx === 0}
              className="bz-btn bz-btn-ghost text-[13px]"
              style={{ borderRadius: 2 }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              上一步
            </button>
            <button
              onClick={goNext}
              className="bz-btn bz-btn-primary text-[13px]"
              style={{ borderRadius: 2 }}
            >
              下一步
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}