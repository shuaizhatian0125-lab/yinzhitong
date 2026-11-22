'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Search, Lightbulb, Users, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CollaborationCard, type Collaboration } from '@/components/domain/CollaborationCard';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
];

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'project', label: '项目协作' },
  { value: 'task', label: '任务协作' },
  { value: 'meeting', label: '会议协作' },
  { value: 'review', label: '评审协作' },
  { value: 'cross_dept', label: '跨部门协作' },
  { value: 'customer', label: '客户协作' },
  { value: 'compliance', label: '合规协作' },
];

const ROLE_OPTIONS = [
  { value: '', label: '全部角色' },
  { value: 'owner', label: '负责人' },
  { value: 'participant', label: '参与者' },
  { value: 'observer', label: '观察者' },
];

const AI_SUGGESTIONS = [
  { title: 'Q4经营分析跨部门协作', reason: '季度末经营分析需要多部门数据协同', type: 'cross_dept' },
  { title: '某企业授信审批协作', reason: '授信流程需要风控、信贷、审批多方协同', type: 'compliance' },
  { title: '新产品上线评审协作', reason: '新产品需要合规、技术、业务三方评审', type: 'review' },
];

export default function CollaborationsListPage() {
  const router = useRouter();
  const [items, setItems] = React.useState<Collaboration[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState('');
  const [type, setType] = React.useState('');
  const [role, setRole] = React.useState('');
  const [keyword, setKeyword] = React.useState('');

  const fetchCollaborations = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (role) params.set('role', role);
      if (keyword) params.set('keyword', keyword);

      const res = await fetch(`/api/v1/collaborations?${params.toString()}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setItems(json.data.items ?? []);
        setTotal(json.data.total ?? 0);
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, type, role, keyword]);

  React.useEffect(() => {
    fetchCollaborations();
  }, [fetchCollaborations]);

  const handleCardClick = (collaboration: Collaboration) => {
    router.push(`/collaborations/${collaboration.id}`);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="协作中心"
        description="人机协同流程、工作流引擎、跨部门协作"
        actions={
          <button
            className="bz-btn bz-btn-primary"
            style={{ borderRadius: 3 }}
            onClick={() => router.push('/collaborations/create')}
          >
            <Plus className="h-4 w-4" />
            创建协作
          </button>
        }
      />

      <div className="bz-card" style={{ borderRadius: 8 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">AI 协作建议</span>
          <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>智能推荐</span>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {AI_SUGGESTIONS.map((suggestion, idx) => (
              <div
                key={idx}
                className="rounded-[6px] border px-3 py-3 transition-colors hover:border-[var(--bz-brand)] cursor-pointer"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 6 }}
                onClick={() => router.push(`/collaborations/create?template=${suggestion.type}&title=${encodeURIComponent(suggestion.title)}`)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="h-4 w-4" style={{ color: 'var(--bz-gold)' }} />
                  <span className="text-[13px] font-medium text-[var(--bz-text)]">{suggestion.title}</span>
                </div>
                <p className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed mb-2">{suggestion.reason}</p>
                <div className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--bz-brand)' }}>
                  一键创建
                  <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 md:flex-wrap">
        <select
          className="text-[13px] px-3 py-2 md:py-1.5 rounded border min-h-[44px]"
          style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          className="text-[13px] px-3 py-2 md:py-1.5 rounded border min-h-[44px]"
          style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          className="text-[13px] px-3 py-2 md:py-1.5 rounded border min-h-[44px]"
          style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 flex-1 min-w-[160px] md:min-w-[200px]">
          <Search className="h-3.5 w-3.5 text-[var(--bz-text-muted)]" />
          <input
            type="text"
            placeholder="搜索协作..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="text-[13px] px-3 py-1.5 rounded border flex-1"
            style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center text-[var(--bz-text-muted)] py-12">
          暂无协作事项
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <CollaborationCard
              key={item.id}
              collaboration={item}
              onClick={handleCardClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}