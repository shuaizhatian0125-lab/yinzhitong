'use client';

import * as React from 'react';
import { Search, Sparkles, BookOpen, AlertTriangle } from 'lucide-react';

type Reference = {
  docTitle: string;
  heading: string | null;
  pageNo: number | null;
  snippet: string;
  score: number;
};

type QueryResult = {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  references: Reference[];
  hasKnowledgeBasis: boolean;
};

const CONFIDENCE_LABELS: Record<string, { label: string; variant: string }> = {
  high: { label: '高置信度', variant: 'bz-badge-ok' },
  medium: { label: '中置信度', variant: 'bz-badge-warn' },
  low: { label: '低置信度', variant: 'bz-badge-danger' },
};

type KnowledgeQueryProps = {
  kbId: string;
};

export function KnowledgeQuery({ kbId }: KnowledgeQueryProps) {
  const [question, setQuestion] = React.useState('');
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [history, setHistory] = React.useState<
    Array<{ question: string; result: QueryResult }>
  >([]);

  const handleQuery = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/v1/knowledge/bases/${kbId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
        body: JSON.stringify({ question }),
      });

      const json = await res.json();
      if (json.code === 0 && json.data) {
        const queryResult = json.data as QueryResult;
        setResult(queryResult);
        setHistory((prev) => [{ question, result: queryResult }, ...prev].slice(0, 10));
      }
    } catch {
      // 忽略错误
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bz-card bz-shadow-soft flex flex-col" style={{ borderRadius: 6 }}>
      <div className="bz-card-head">
        <span className="bz-card-title flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
          知识问答
        </span>
      </div>

      <div className="p-3">
        <div
          className="flex h-9 w-full items-center gap-2 rounded border px-3"
          style={{ background: 'var(--bz-bg)', borderColor: 'var(--bz-line-strong)' }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--bz-text-muted)' }} />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                e.preventDefault();
                handleQuery();
              }
            }}
            placeholder="输入问题…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--bz-text-muted)]"
          />
          <button
            onClick={handleQuery}
            disabled={loading || !question.trim()}
            className="bz-btn bz-btn-primary text-[12px]"
            style={{ borderRadius: 4 }}
          >
            {loading ? '查询中…' : '查询'}
          </button>
        </div>
      </div>

      {result && (
        <div className="px-3 pb-3 flex flex-col gap-3">
          {!result.hasKnowledgeBasis && (
            <div
              className="flex items-center gap-2 rounded px-3 py-2"
              style={{ background: '#fef3cd', borderRadius: 3 }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--bz-warn)' }} />
              <span className="text-[12px]" style={{ color: '#856404' }}>
                知识库中未找到依据
              </span>
            </div>
          )}

          <div
            className="rounded px-3 py-3"
            style={{ background: 'var(--bz-brand-tint)', borderRadius: 3 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium" style={{ color: 'var(--bz-brand)' }}>
                AI 回答
              </span>
              <span
                className={`bz-badge ${CONFIDENCE_LABELS[result.confidence]?.variant ?? 'bz-badge-gray'}`}
                style={{ fontSize: 11 }}
              >
                {CONFIDENCE_LABELS[result.confidence]?.label ?? '未知'}
              </span>
            </div>
            <p className="text-[13px] text-[var(--bz-text)] leading-relaxed whitespace-pre-wrap">
              {result.answer}
            </p>
          </div>

          {result.references.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-[var(--bz-text)]">引用来源</span>
              {result.references.map((ref, idx) => (
                <div
                  key={idx}
                  className="rounded border px-3 py-2"
                  style={{ borderColor: 'var(--bz-line)', borderRadius: 3 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="h-3 w-3" style={{ color: 'var(--bz-brand)' }} />
                    <span className="text-[12px] font-medium text-[var(--bz-text)]">
                      《{ref.docTitle}》
                    </span>
                    {ref.heading && (
                      <span className="text-[11px] text-[var(--bz-text-muted)]">
                        [{ref.heading}]
                      </span>
                    )}
                    {ref.pageNo && (
                      <span className="text-[11px] text-[var(--bz-text-muted)]">
                        第{ref.pageNo}页
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--bz-text-muted)] leading-relaxed">
                    {ref.snippet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {history.length > 0 && !result && (
        <div className="px-3 pb-3">
          <span className="text-[12px] font-medium text-[var(--bz-text)] mb-2 block">
            问答历史
          </span>
          {history.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#fafcfe]"
              onClick={() => {
                setQuestion(item.question);
                setResult(item.result);
              }}
            >
              <span className="text-[12px] text-[var(--bz-text)] truncate flex-1">
                {item.question}
              </span>
              <span
                className={`bz-badge ${CONFIDENCE_LABELS[item.result.confidence]?.variant ?? 'bz-badge-gray'}`}
                style={{ fontSize: 10 }}
              >
                {CONFIDENCE_LABELS[item.result.confidence]?.label ?? ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}