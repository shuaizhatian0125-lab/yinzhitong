'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Save, Package } from 'lucide-react';

type ModuleItem = {
  code: string;
  name: string;
  route: string;
  icon: string | null;
  sort: number;
  tier: string;
  dependsOn: string[];
  status: string;
  enabled: boolean;
};

const TIER_LABELS: Record<string, string> = {
  P0: '核心',
  P1: '重要',
  P2: '一般',
  P3: '可选',
};

export default function ModulesPage() {
  const [modules, setModules] = React.useState<ModuleItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [changes, setChanges] = React.useState<Map<string, boolean>>(new Map());

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/modules');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setModules(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(code: string, enabled: boolean) {
    setChanges((prev) => {
      const next = new Map(prev);
      next.set(code, enabled);
      return next;
    });
    setModules((prev) =>
      prev.map((m) => (m.code === code ? { ...m, enabled } : m)),
    );
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const modulesToSave = Array.from(changes.entries()).map(([code, enabled]) => ({
        code,
        enabled,
      }));
      if (modulesToSave.length === 0) return;

      const res = await fetch('/api/v1/admin/modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: modulesToSave }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setModules(json.data.items ?? []);
        setChanges(new Map());
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = changes.size > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="模块管理"
        description="启用或停用平台功能模块，控制模块可见性"
        actions={
          hasChanges ? (
            <button
              onClick={saveChanges}
              disabled={saving}
              className="bz-btn bz-btn-primary text-[13px] flex items-center gap-1 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? '保存中…' : '保存更改'}
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="bz-card p-8 text-center text-[14px] text-[var(--bz-text-muted)]" style={{ borderRadius: 6 }}>
          加载中…
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((m) => (
            <div
              key={m.code}
              className="bz-card p-4 flex flex-col gap-2"
              style={{ borderRadius: 6 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
                  <span className="text-[14px] font-medium text-[var(--bz-text)]">{m.name}</span>
                </div>
                <button
                  onClick={() => toggleModule(m.code, !m.enabled)}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  style={{
                    background: m.enabled ? 'var(--bz-brand)' : 'var(--bz-line-strong)',
                  }}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
                    style={{
                      transform: m.enabled ? 'translateX(18px)' : 'translateX(2px)',
                    }}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <span
                  className="px-1.5 py-0.5"
                  style={{
                    background: m.tier === 'P0' ? 'var(--bz-gold-tint)' : 'var(--bz-brand-tint)',
                    color: m.tier === 'P0' ? 'var(--bz-gold)' : 'var(--bz-brand)',
                    borderRadius: 6,
                  }}
                >
                  {TIER_LABELS[m.tier] ?? m.tier}
                </span>
                <span className="text-[var(--bz-text-muted)]">{m.code}</span>
              </div>
              {m.dependsOn.length > 0 && (
                <div className="text-[12px] text-[var(--bz-text-muted)]">
                  依赖：{m.dependsOn.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}