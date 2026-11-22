'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, FileText, Database, Code, Image,
  MessageSquare, ChartBar, BookOpen, Shield,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type ContextItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  credibility: 'verified' | 'trusted' | 'unverified' | 'disputed';
  hasConflict: boolean;
  createdBy: string;
  createdAt: string;
};

const CONTEXT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  document: { label: '文档', icon: <FileText className="h-4 w-4" /> },
  data: { label: '数据', icon: <Database className="h-4 w-4" /> },
  code: { label: '代码', icon: <Code className="h-4 w-4" /> },
  image: { label: '图像', icon: <Image className="h-4 w-4" /> },
  message: { label: '消息', icon: <MessageSquare className="h-4 w-4" /> },
  report: { label: '报告', icon: <ChartBar className="h-4 w-4" /> },
  knowledge: { label: '知识', icon: <BookOpen className="h-4 w-4" /> },
  policy: { label: '政策', icon: <Shield className="h-4 w-4" /> },
  decision: { label: '决策', icon: <AlertCircle className="h-4 w-4" /> },
};

const CREDIBILITY_CONFIG: Record<string, { label: string; color: string }> = {
  verified: { label: '已验证', color: 'var(--bz-ok)' },
  trusted: { label: '可信', color: 'var(--bz-info)' },
  unverified: { label: '未验证', color: 'var(--bz-warn)' },
  disputed: { label: '有争议', color: 'var(--bz-danger)' },
};

export default function ContextPage() {
  const params = useParams();
  const collaborationId = params.id as string;
  const [items, setItems] = React.useState<ContextItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState<string>('');

  const fetchContext = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/context`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setItems(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [collaborationId]);

  React.useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const filteredItems = typeFilter ? items.filter((i) => i.type === typeFilter) : items;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="共享上下文" description="9种上下文类型的共享知识视图" />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTypeFilter('')}
          className="text-[12px] px-2 py-1 rounded"
          style={{
            borderRadius: 2,
            background: typeFilter === '' ? 'var(--bz-brand)' : 'transparent',
            color: typeFilter === '' ? '#fff' : 'var(--bz-text-sub)',
          }}
        >
          全部
        </button>
        {Object.entries(CONTEXT_TYPE_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className="text-[12px] px-2 py-1 rounded flex items-center gap-1"
            style={{
              borderRadius: 2,
              background: typeFilter === key ? 'var(--bz-brand)' : 'transparent',
              color: typeFilter === key ? '#fff' : 'var(--bz-text-sub)',
            }}
          >
            {config.icon}
            {config.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="text-center text-[var(--bz-text-muted)] py-12">
          暂无共享上下文
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const typeConfig = CONTEXT_TYPE_CONFIG[item.type] ?? { label: item.type, icon: <FileText className="h-4 w-4" /> };
            const credConfig = CREDIBILITY_CONFIG[item.credibility] ?? CREDIBILITY_CONFIG.unverified;

            return (
              <div
                key={item.id}
                className="bz-card"
                style={{
                  borderRadius: 6,
                  padding: '10px 14px',
                  borderLeft: item.hasConflict ? '3px solid var(--bz-danger)' : '3px solid transparent',
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--bz-text-sub)' }}>{typeConfig.icon}</span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)', borderRadius: 2 }}
                    >
                      {typeConfig.label}
                    </span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: `${credConfig.color}15`, color: credConfig.color, borderRadius: 2 }}
                    >
                      {credConfig.label}
                    </span>
                    {item.hasConflict && (
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bz-danger-tint)', color: 'var(--bz-danger)', borderRadius: 2 }}
                      >
                        冲突
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--bz-text-muted)]">
                    {item.createdBy} · {new Date(item.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="text-[14px] font-medium text-[var(--bz-text)] mb-0.5">{item.title}</div>
                <div className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed line-clamp-2">{item.content}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}