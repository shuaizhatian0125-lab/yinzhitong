'use client';

import * as React from 'react';
import { Loader2, Search, Filter, Eye, EyeOff, Trash2 } from 'lucide-react';

type MemoryCategory = 'preference' | 'fact' | 'skill' | 'context' | 'relationship' | 'instruction';
type MemoryScope = 'global' | 'org' | 'dept' | 'team' | 'user' | 'session' | 'task' | 'step';

type MemoryItem = {
  id: string;
  category: MemoryCategory;
  scope: MemoryScope;
  key: string;
  value: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  createdAt: string;
  updatedAt: string;
};

const CATEGORY_LABEL: Record<MemoryCategory, string> = {
  preference: '偏好',
  fact: '事实',
  skill: '技能',
  context: '上下文',
  relationship: '关系',
  instruction: '指令',
};

const SCOPE_LABEL: Record<MemoryScope, string> = {
  global: '全局',
  org: '组织',
  dept: '部门',
  team: '团队',
  user: '用户',
  session: '会话',
  task: '任务',
  step: '步骤',
};

const SENSITIVITY_CONFIG: Record<string, { label: string; color: string }> = {
  public: { label: '公开', color: 'var(--bz-ok)' },
  internal: { label: '内部', color: 'var(--bz-info)' },
  confidential: { label: '机密', color: 'var(--bz-warn)' },
  restricted: { label: '受限', color: 'var(--bz-danger)' },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }));
const SCOPE_OPTIONS = Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label }));

export function MemoryPanel() {
  const [items, setItems] = React.useState<MemoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [categoryFilter, setCategoryFilter] = React.useState<MemoryCategory | ''>('');
  const [scopeFilter, setScopeFilter] = React.useState<MemoryScope | ''>('');
  const [keyword, setKeyword] = React.useState('');
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(new Set());

  const fetchMemories = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (scopeFilter) params.set('scope', scopeFilter);
      if (keyword) params.set('keyword', keyword);

      const res = await fetch(`/api/v1/ai/memories?${params.toString()}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setItems(json.data.items ?? []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, scopeFilter, keyword]);

  React.useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/v1/ai/memories/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // ignore
    }
  };

  const toggleHidden = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredItems = items.filter((item) => {
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (scopeFilter && item.scope !== scopeFilter) return false;
    if (keyword && !item.key.includes(keyword) && !item.value.includes(keyword)) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bz-card" style={{ borderRadius: 4 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">Memory 管理</span>
          <span className="text-[12px] text-[var(--bz-text-muted)]">{filteredItems.length} 条</span>
        </div>

        <div className="p-3 flex items-center gap-2 flex-wrap">
          <select
            className="text-[13px] px-2 py-1.5 rounded border"
            style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as MemoryCategory | '')}
          >
            <option value="">全部分类</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="text-[13px] px-2 py-1.5 rounded border"
            style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as MemoryScope | '')}
          >
            <option value="">全部作用域</option>
            {SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 flex-1 min-w-[160px]">
            <Search className="h-3.5 w-3.5 text-[var(--bz-text-muted)]" />
            <input
              type="text"
              placeholder="搜索 Memory..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="text-[13px] px-2 py-1.5 rounded border flex-1"
              style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="text-center text-[13px] text-[var(--bz-text-muted)] py-8">
          暂无 Memory 记录
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const isHidden = hiddenIds.has(item.id);
            const sensConfig = SENSITIVITY_CONFIG[item.sensitivity];

            return (
              <div
                key={item.id}
                className="bz-card"
                style={{ borderRadius: 3, padding: '10px 14px' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)', borderRadius: 2 }}
                    >
                      {CATEGORY_LABEL[item.category]}
                    </span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bz-border)', color: 'var(--bz-text-sub)', borderRadius: 2 }}
                    >
                      {SCOPE_LABEL[item.scope]}
                    </span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: `${sensConfig.color}15`, color: sensConfig.color, borderRadius: 2 }}
                    >
                      {sensConfig.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleHidden(item.id)}
                      className="p-1 rounded hover:bg-[var(--bz-border)]"
                      style={{ borderRadius: 2 }}
                    >
                      {isHidden ? <EyeOff className="h-3.5 w-3.5 text-[var(--bz-text-muted)]" /> : <Eye className="h-3.5 w-3.5 text-[var(--bz-text-sub)]" />}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded hover:bg-[var(--bz-border)]"
                      style={{ borderRadius: 2 }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--bz-danger)]" />
                    </button>
                  </div>
                </div>

                <div className="text-[13px] font-medium text-[var(--bz-text)] mb-0.5">
                  {item.key}
                </div>
                <div className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed">
                  {isHidden ? '••••••••（已隐藏敏感内容）' : item.value}
                </div>

                <div className="text-[11px] text-[var(--bz-text-muted)] mt-1">
                  更新于 {new Date(item.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}