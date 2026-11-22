'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Users, Target, Calendar, TrendingUp, Loader2, Plus, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';

type ContactItem = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  mobile_enc: string | null;
  decision_role: string | null;
};

type OpportunityItem = {
  id: string;
  title: string;
  stage: string;
  amount: number | null;
  probability: number | null;
  expected_close_at: string | null;
};

type VisitItem = {
  id: string;
  visited_at: string;
  purpose: string | null;
  summary: string | null;
  next_action: string | null;
};

type Customer360Data = {
  basicInfo: {
    id: string;
    name: string;
    type: string;
    level: string;
    status: string;
    tags: string[];
  };
  profile: Record<string, unknown>;
  contacts: ContactItem[];
  opportunities: OpportunityItem[];
  visitRecords: VisitItem[];
  lifecycleStage: string;
  segmentInfo: string;
  strategy: string;
};

type VisitPlanData = {
  customerId: string;
  customerName: string;
  visitDate: string;
  objectives: string[];
  talkingPoints: string[];
  recommendedProducts: string[];
  riskReminders: string[];
  preparationChecklist: string[];
};

type OpportunitySuggestionItem = {
  customerId: string;
  customerName: string;
  title: string;
  description: string;
  estimatedAmount: number | null;
  probability: number;
  expectedCloseAt: string | null;
  rationale: string;
  confirmed: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  corp: '对公',
  retail: '零售',
};

const STAGE_LABEL: Record<string, string> = {
  initial: '初步接触',
  qualification: '需求确认',
  proposal: '方案提交',
  negotiation: '商务谈判',
  closed_won: '已成交',
  closed_lost: '已流失',
  identification: '商机识别',
  initial_contact: '初步接触',
  requirement_confirmation: '需求确认',
  solution_design: '方案设计',
  business_negotiation: '商务谈判',
  contract_signed: '合同签订',
  lost: '已流失',
};

const OPPORTUNITY_STAGES_ORDER = [
  'identification',
  'initial_contact',
  'requirement_confirmation',
  'solution_design',
  'business_negotiation',
  'contract_signed',
  'lost',
];

function getNextStage(currentStage: string): string | null {
  const idx = OPPORTUNITY_STAGES_ORDER.indexOf(currentStage);
  if (idx === -1 || idx >= OPPORTUNITY_STAGES_ORDER.length - 2) return null;
  return OPPORTUNITY_STAGES_ORDER[idx + 1];
}

const LIFECYCLE_VARIANT: Record<string, string> = {
  '流失期': 'bz-badge-danger',
  '活跃期': 'bz-badge-ok',
  '维护期': 'bz-badge-blue',
  '重点期': 'bz-badge-warn',
  '观察期': 'bz-badge-gray',
};

const TABS = [
  { key: 'overview', label: '客户画像', icon: Users },
  { key: 'opportunity', label: '商机识别', icon: Target },
  { key: 'visit', label: '拜访规划', icon: Calendar },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const DECISION_ROLE_OPTIONS = [
  { value: 'decision_maker', label: '决策者' },
  { value: 'influencer', label: '影响者' },
  { value: 'user', label: '使用者' },
  { value: 'gatekeeper', label: '把关人' },
  { value: 'other', label: '其他' },
];

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const customerId = params.id;

  const [customerData, setCustomerData] = React.useState<Customer360Data | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<TabKey>('overview');
  const [visitPlan, setVisitPlan] = React.useState<VisitPlanData | null>(null);
  const [generatingPlan, setGeneratingPlan] = React.useState(false);
  const [opportunitySuggestions, setOpportunitySuggestions] = React.useState<OpportunitySuggestionItem[]>([]);
  const [identifyingOpp, setIdentifyingOpp] = React.useState(false);
  const [confirmingOpp, setConfirmingOpp] = React.useState<string | null>(null);

  const [visitDialogOpen, setVisitDialogOpen] = React.useState(false);
  const [contactDialogOpen, setContactDialogOpen] = React.useState(false);
  const [transitionDialogOpen, setTransitionDialogOpen] = React.useState(false);
  const [transitionOppId, setTransitionOppId] = React.useState<string | null>(null);
  const [transitionTargetStage, setTransitionTargetStage] = React.useState<string>('');
  const [submittingVisit, setSubmittingVisit] = React.useState(false);
  const [submittingContact, setSubmittingContact] = React.useState(false);
  const [submittingTransition, setSubmittingTransition] = React.useState(false);

  const [visitForm, setVisitForm] = React.useState({
    visited_at: new Date().toISOString().split('T')[0],
    purpose: '',
    summary: '',
    next_action: '',
  });

  const [contactForm, setContactForm] = React.useState({
    name: '',
    title: '',
    mobile_enc: '',
    email: '',
    decision_role: '',
  });

  const [transitionForm, setTransitionForm] = React.useState({
    reason: '',
    lost_reason: '',
  });

  const fetchCustomer = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setCustomerData(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  React.useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const handleGenerateVisitPlan = async () => {
    setGeneratingPlan(true);
    try {
      const visitDate = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/v1/customers/${customerId}/visit-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visit_date: visitDate }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setVisitPlan(json.data);
      }
    } catch {
      // ignore
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleIdentifyOpportunity = async () => {
    setIdentifyingOpp(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/opportunities/identify`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setOpportunitySuggestions(json.data);
      }
    } catch {
      // ignore
    } finally {
      setIdentifyingOpp(false);
    }
  };

  const handleConfirmOpportunity = async (idx: number) => {
    const suggestion = opportunitySuggestions[idx];
    if (!suggestion) return;
    setConfirmingOpp(suggestion.title);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestion.title,
          amount: suggestion.estimatedAmount,
          probability: suggestion.probability,
          expected_close_at: suggestion.expectedCloseAt,
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        const updated = [...opportunitySuggestions];
        updated[idx] = { ...suggestion, confirmed: true };
        setOpportunitySuggestions(updated);
        fetchCustomer();
      }
    } catch {
      // ignore
    } finally {
      setConfirmingOpp(null);
    }
  };

  const handleCreateVisit = async () => {
    if (!visitForm.purpose.trim()) return;
    setSubmittingVisit(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visited_at: visitForm.visited_at,
          purpose: visitForm.purpose,
          summary: visitForm.summary || undefined,
          next_action: visitForm.next_action || undefined,
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setVisitDialogOpen(false);
        setVisitForm({
          visited_at: new Date().toISOString().split('T')[0],
          purpose: '',
          summary: '',
          next_action: '',
        });
        fetchCustomer();
      }
    } catch {
      // ignore
    } finally {
      setSubmittingVisit(false);
    }
  };

  const handleCreateContact = async () => {
    if (!contactForm.name.trim()) return;
    setSubmittingContact(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactForm.name,
          title: contactForm.title || undefined,
          mobile_enc: contactForm.mobile_enc || undefined,
          email: contactForm.email || undefined,
          decision_role: contactForm.decision_role || undefined,
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setContactDialogOpen(false);
        setContactForm({ name: '', title: '', mobile_enc: '', email: '', decision_role: '' });
        fetchCustomer();
      }
    } catch {
      // ignore
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleOpenTransition = (oppId: string, currentStage: string) => {
    const next = getNextStage(currentStage);
    if (!next) return;
    setTransitionOppId(oppId);
    setTransitionTargetStage(next);
    setTransitionForm({ reason: '', lost_reason: '' });
    setTransitionDialogOpen(true);
  };

  const handleTransitionStage = async () => {
    if (!transitionOppId) return;
    setSubmittingTransition(true);
    try {
      const body: Record<string, string> = {
        target_stage: transitionTargetStage,
      };
      if (transitionForm.reason) body.reason = transitionForm.reason;
      if (transitionTargetStage === 'lost' && transitionForm.lost_reason) {
        body.lost_reason = transitionForm.lost_reason;
      }

      const res = await fetch(
        `/api/v1/customers/${customerId}/opportunities/${transitionOppId}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (json.code === 0) {
        setTransitionDialogOpen(false);
        setTransitionOppId(null);
        fetchCustomer();
      }
    } catch {
      // ignore
    } finally {
      setSubmittingTransition(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--bz-text-muted)]" />
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-[var(--bz-text-muted)]">客户不存在或已被删除</p>
        <button className="bz-btn bz-btn-default" onClick={() => router.push('/centers/customer')}>
          返回客户列表
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          className="bz-btn bz-btn-ghost"
          onClick={() => router.push('/centers/customer')}
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </button>
      </div>

      <PageHeader title={customerData.basicInfo.name} description="客户360°全景视图与经营策略" />

      {/* 生命周期与策略提示 */}
      <div className="flex gap-4">
        <div className="bz-card" style={{ borderRadius: 8, flex: 1 }}>
          <div className="p-3 flex items-center gap-3">
            <span className="text-[12px] text-[var(--bz-text-sub)]">生命周期</span>
            <span className={`bz-badge ${LIFECYCLE_VARIANT[customerData.lifecycleStage] ?? 'bz-badge-gray'}`}>
              {customerData.lifecycleStage}
            </span>
            <span className="text-[12px] text-[var(--bz-text-sub)] ml-3">所属客群</span>
            <span className="bz-badge bz-badge-blue">{customerData.segmentInfo}</span>
          </div>
        </div>
      </div>

      <div className="bz-card" style={{ borderRadius: 8 }}>
        <div className="p-3" style={{ background: 'var(--bz-brand-tint)', borderRadius: '8px 8px 0 0' }}>
          <p className="text-[13px] text-[var(--bz-text)]">
            <span className="font-medium">经营策略建议：</span>
            {customerData.strategy}
          </p>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className={`rounded px-4 py-2 text-[13px] font-medium transition-colors flex items-center gap-2 ${
                isActive ? 'text-[var(--bz-brand)]' : 'text-[var(--bz-text-sub)]'
              }`}
              style={{
                background: isActive ? 'var(--bz-brand-tint)' : 'transparent',
                borderRadius: 6,
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 内容 */}
      {activeTab === 'overview' && (
        <div className="flex gap-4">
          <div className="flex-1" style={{ flexBasis: '70%' }}>
            <div className="bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">基本信息</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[12px] text-[var(--bz-text-sub)] block mb-1">客户名称</span>
                    <p className="text-[14px] text-[var(--bz-text)]">{customerData.basicInfo.name}</p>
                  </div>
                  <div>
                    <span className="text-[12px] text-[var(--bz-text-sub)] block mb-1">客户类型</span>
                    <p className="text-[14px] text-[var(--bz-text)]">{TYPE_LABEL[customerData.basicInfo.type] ?? customerData.basicInfo.type}</p>
                  </div>
                  <div>
                    <span className="text-[12px] text-[var(--bz-text-sub)] block mb-1">客户等级</span>
                    <p className="text-[14px] text-[var(--bz-text)]">{customerData.basicInfo.level}</p>
                  </div>
                  <div>
                    <span className="text-[12px] text-[var(--bz-text-sub)] block mb-1">客户状态</span>
                    <p className="text-[14px] text-[var(--bz-text)]">{customerData.basicInfo.status}</p>
                  </div>
                  <div>
                    <span className="text-[12px] text-[var(--bz-text-sub)] block mb-1">标签</span>
                    <div className="flex flex-wrap gap-1">
                      {customerData.basicInfo.tags.length > 0 ? (
                        customerData.basicInfo.tags.map((tag) => (
                          <span key={tag} className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[var(--bz-text-muted)]">无</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 联系人 */}
            <div className="mt-4 bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">联系人</span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[var(--bz-text-muted)]">{customerData.contacts.length} 人</span>
                  <button
                    className="bz-btn bz-btn-default"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setContactDialogOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    添加联系人
                  </button>
                </div>
              </div>
              <div className="p-3">
                {customerData.contacts.length === 0 ? (
                  <p className="text-center text-[var(--bz-text-muted)] py-4">暂无联系人信息</p>
                ) : (
                  customerData.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 px-3 py-2.5"
                      style={{ borderBottom: '1px solid #eef2f6' }}
                    >
                      <span className="text-[14px] font-medium text-[var(--bz-text)]">{contact.name}</span>
                      <span className="text-[12px] text-[var(--bz-text-sub)]">{contact.title ?? '待补充'}</span>
                      {contact.decision_role && (
                        <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
                          {DECISION_ROLE_OPTIONS.find((o) => o.value === contact.decision_role)?.label ?? contact.decision_role}
                        </span>
                      )}
                      <span className="text-[12px] text-[var(--bz-text-muted)] ml-auto">{contact.email ?? ''}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 商机列表 */}
            <div className="mt-4 bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">商机</span>
                <span className="text-[12px] text-[var(--bz-text-muted)]">{customerData.opportunities.length} 个</span>
              </div>
              <div className="p-3">
                {customerData.opportunities.length === 0 ? (
                  <p className="text-center text-[var(--bz-text-muted)] py-4">暂无商机记录</p>
                ) : (
                  customerData.opportunities.map((opp) => {
                    const nextStage = getNextStage(opp.stage);
                    const isFinished = opp.stage === 'contract_signed' || opp.stage === 'lost';
                    return (
                      <div
                        key={opp.id}
                        className="px-3 py-2.5"
                        style={{ borderBottom: '1px solid #eef2f6' }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[14px] font-medium text-[var(--bz-text)]">{opp.title}</span>
                          <span className="bz-badge bz-badge-blue">{STAGE_LABEL[opp.stage] ?? opp.stage}</span>
                          {opp.amount !== null && (
                            <span className="text-[12px] text-[var(--bz-text-muted)]">{opp.amount} 万元</span>
                          )}
                          {opp.probability !== null && (
                            <span className="text-[12px] text-[var(--bz-text-muted)]">概率 {opp.probability}%</span>
                          )}
                          {!isFinished && nextStage && (
                            <button
                              className="bz-btn bz-btn-default ml-auto"
                              style={{ fontSize: 12, padding: '4px 10px' }}
                              onClick={() => handleOpenTransition(opp.id, opp.stage)}
                            >
                              推进至 {STAGE_LABEL[nextStage] ?? nextStage}
                              <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </button>
                          )}
                          {isFinished && (
                            <span className="ml-auto text-[12px] text-[var(--bz-text-muted)]">已结束</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 拜访记录 */}
            <div className="mt-4 bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">最近拜访记录</span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[var(--bz-text-muted)]">{customerData.visitRecords.length} 条</span>
                  <button
                    className="bz-btn bz-btn-default"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setVisitDialogOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    新建拜访记录
                  </button>
                </div>
              </div>
              <div className="p-3">
                {customerData.visitRecords.length === 0 ? (
                  <p className="text-center text-[var(--bz-text-muted)] py-4">暂无拜访记录</p>
                ) : (
                  customerData.visitRecords.map((visit) => (
                    <div
                      key={visit.id}
                      className="px-3 py-2.5"
                      style={{ borderBottom: '1px solid #eef2f6' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] text-[var(--bz-text-muted)]">
                          {new Date(visit.visited_at).toLocaleDateString('zh-CN')}
                        </span>
                        <span className="text-[13px] text-[var(--bz-text)]">{visit.purpose ?? '待补充'}</span>
                      </div>
                      {visit.summary && (
                        <p className="text-[12px] text-[var(--bz-text-sub)]">{visit.summary}</p>
                      )}
                      {visit.next_action && (
                        <p className="text-[12px] text-[var(--bz-text-muted)] mt-1">后续行动: {visit.next_action}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 右侧画像补充 */}
          <div style={{ flexBasis: '30%', flexShrink: 0 }}>
            <div className="bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">客户画像</span>
              </div>
              <div className="p-3">
                {Object.keys(customerData.profile).length === 0 ? (
                  <p className="text-center text-[var(--bz-text-muted)] py-4">暂无画像数据</p>
                ) : (
                  Object.entries(customerData.profile).map(([key, value]) => (
                    <div
                      key={key}
                      className="px-3 py-2"
                      style={{ borderBottom: '1px solid #eef2f6' }}
                    >
                      <span className="text-[12px] text-[var(--bz-text-sub)] block mb-0.5">{key}</span>
                      <p className="text-[13px] text-[var(--bz-text)]">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'opportunity' && (
        <div className="flex flex-col gap-4">
          <div className="bz-card" style={{ borderRadius: 8 }}>
            <div className="bz-card-head">
              <span className="bz-card-title">商机识别</span>
              <button
                className="bz-btn bz-btn-default"
                onClick={handleIdentifyOpportunity}
                disabled={identifyingOpp}
              >
                {identifyingOpp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    识别中…
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-1" />
                    AI识别商机
                  </>
                )}
              </button>
            </div>
            <div className="p-4">
              {opportunitySuggestions.length === 0 ? (
                <p className="text-center text-[var(--bz-text-muted)] py-8">
                  点击"AI识别商机"按钮，系统将基于客户信息智能识别潜在商机
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {opportunitySuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="rounded border p-3"
                      style={{ borderColor: 'var(--bz-line)', borderRadius: 6 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[14px] font-medium text-[var(--bz-text)]">
                          {suggestion.title}
                        </span>
                        {suggestion.confirmed ? (
                          <span className="bz-badge bz-badge-ok">已录入</span>
                        ) : (
                          <button
                            className="bz-btn bz-btn-default"
                            style={{ fontSize: 12, padding: '4px 12px' }}
                            onClick={() => handleConfirmOpportunity(idx)}
                            disabled={confirmingOpp === suggestion.title}
                          >
                            {confirmingOpp === suggestion.title ? '确认中…' : '确认录入'}
                          </button>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--bz-text-sub)] mb-2">{suggestion.description}</p>
                      <div className="flex items-center gap-4 text-[12px] text-[var(--bz-text-muted)]">
                        {suggestion.estimatedAmount !== null && (
                          <span>预计金额: {suggestion.estimatedAmount} 万元</span>
                        )}
                        <span>成交概率: {suggestion.probability}%</span>
                        {suggestion.expectedCloseAt && (
                          <span>预期关闭: {suggestion.expectedCloseAt}</span>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--bz-text-muted)] mt-2">
                        识别依据: {suggestion.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'visit' && (
        <div className="flex flex-col gap-4">
          <div className="bz-card" style={{ borderRadius: 8 }}>
            <div className="bz-card-head">
              <span className="bz-card-title">拜访准备方案</span>
              <button
                className="bz-btn bz-btn-default"
                onClick={handleGenerateVisitPlan}
                disabled={generatingPlan}
              >
                {generatingPlan ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    生成中…
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-1" />
                    生成拜访方案
                  </>
                )}
              </button>
            </div>
            <div className="p-4">
              {!visitPlan ? (
                <p className="text-center text-[var(--bz-text-muted)] py-8">
                  点击"生成拜访方案"按钮，系统将基于客户信息智能生成拜访准备方案
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">拜访目标</span>
                    <ul className="flex flex-col gap-1">
                      {visitPlan.objectives.map((obj, idx) => (
                        <li key={idx} className="text-[13px] text-[var(--bz-text-sub)] flex items-start gap-2">
                          <span className="text-[var(--bz-brand)] mt-0.5">•</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">谈话要点</span>
                    <ul className="flex flex-col gap-1">
                      {visitPlan.talkingPoints.map((point, idx) => (
                        <li key={idx} className="text-[13px] text-[var(--bz-text-sub)] flex items-start gap-2">
                          <span className="text-[var(--bz-brand)] mt-0.5">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">推荐产品</span>
                    <div className="flex flex-wrap gap-1">
                      {visitPlan.recommendedProducts.map((product, idx) => (
                        <span key={idx} className="bz-badge bz-badge-blue">{product}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">风险提醒</span>
                    <ul className="flex flex-col gap-1">
                      {visitPlan.riskReminders.map((risk, idx) => (
                        <li key={idx} className="text-[13px] text-[var(--bz-text-sub)] flex items-start gap-2">
                          <span className="text-[var(--bz-danger)] mt-0.5">•</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">准备事项</span>
                    <ul className="flex flex-col gap-1">
                      {visitPlan.preparationChecklist.map((item, idx) => (
                        <li key={idx} className="text-[13px] text-[var(--bz-text-sub)] flex items-start gap-2">
                          <span className="text-[var(--bz-ok)] mt-0.5">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 新建拜访记录弹窗 */}
      <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建拜访记录</DialogTitle>
            <DialogDescription>记录本次拜访的客户沟通信息</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visit-date">拜访日期 *</Label>
              <Input
                id="visit-date"
                type="date"
                value={visitForm.visited_at}
                onChange={(e) => setVisitForm({ ...visitForm, visited_at: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visit-purpose">拜访目的 *</Label>
              <Input
                id="visit-purpose"
                placeholder="如：产品推介、需求调研、关系维护"
                value={visitForm.purpose}
                onChange={(e) => setVisitForm({ ...visitForm, purpose: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visit-summary">拜访摘要</Label>
              <Textarea
                id="visit-summary"
                placeholder="记录拜访过程中的关键信息"
                value={visitForm.summary}
                onChange={(e) => setVisitForm({ ...visitForm, summary: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visit-next-action">后续行动</Label>
              <Input
                id="visit-next-action"
                placeholder="如：下周发送方案、安排二次拜访"
                value={visitForm.next_action}
                onChange={(e) => setVisitForm({ ...visitForm, next_action: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              className="bz-btn bz-btn-ghost"
              onClick={() => setVisitDialogOpen(false)}
            >
              取消
            </button>
            <button
              className="bz-btn bz-btn-default"
              onClick={handleCreateVisit}
              disabled={submittingVisit || !visitForm.purpose.trim()}
            >
              {submittingVisit ? '提交中…' : '保存'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加联系人弹窗 */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加联系人</DialogTitle>
            <DialogDescription>录入客户方的联系人信息</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-name">姓名 *</Label>
              <Input
                id="contact-name"
                placeholder="联系人姓名"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-title">职务</Label>
              <Input
                id="contact-title"
                placeholder="如：财务总监、总经理"
                value={contactForm.title}
                onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-mobile">手机号</Label>
              <Input
                id="contact-mobile"
                placeholder="联系人手机号"
                value={contactForm.mobile_enc}
                onChange={(e) => setContactForm({ ...contactForm, mobile_enc: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-email">邮箱</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="联系人邮箱"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>决策角色</Label>
              <Select
                value={contactForm.decision_role}
                onValueChange={(value) => setContactForm({ ...contactForm, decision_role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择决策角色" />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button
              className="bz-btn bz-btn-ghost"
              onClick={() => setContactDialogOpen(false)}
            >
              取消
            </button>
            <button
              className="bz-btn bz-btn-default"
              onClick={handleCreateContact}
              disabled={submittingContact || !contactForm.name.trim()}
            >
              {submittingContact ? '提交中…' : '保存'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 商机阶段流转弹窗 */}
      <Dialog open={transitionDialogOpen} onOpenChange={setTransitionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>推进商机阶段</DialogTitle>
            <DialogDescription>
              将商机从「{STAGE_LABEL[customerData.opportunities.find((o) => o.id === transitionOppId)?.stage ?? ''] ?? ''}」推进至「{STAGE_LABEL[transitionTargetStage] ?? transitionTargetStage}」
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transition-reason">流转原因</Label>
              <Textarea
                id="transition-reason"
                placeholder="说明本次阶段流转的原因"
                value={transitionForm.reason}
                onChange={(e) => setTransitionForm({ ...transitionForm, reason: e.target.value })}
              />
            </div>
            {transitionTargetStage === 'lost' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="transition-lost-reason">流失原因 *</Label>
                <Textarea
                  id="transition-lost-reason"
                  placeholder="说明商机流失的原因"
                  value={transitionForm.lost_reason}
                  onChange={(e) => setTransitionForm({ ...transitionForm, lost_reason: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              className="bz-btn bz-btn-ghost"
              onClick={() => setTransitionDialogOpen(false)}
            >
              取消
            </button>
            <button
              className="bz-btn bz-btn-default"
              onClick={handleTransitionStage}
              disabled={
                submittingTransition ||
                (transitionTargetStage === 'lost' && !transitionForm.lost_reason.trim())
              }
            >
              {submittingTransition ? '提交中…' : '确认推进'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}