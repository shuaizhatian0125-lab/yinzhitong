'use client';

import * as React from 'react';
import { Loader2, Handshake } from 'lucide-react';

export type ServiceMatchItem = {
  productId: string;
  productName: string;
  productCategory: string;
  description: string | null;
  matchScore: number;
  matchReason: string;
  priority: 'high' | 'medium' | 'low';
  rateRange: string | null;
  termRange: string | null;
};

type ServiceMatchPanelProps = {
  enterpriseId: string;
};

const PRIORITY_VARIANT: Record<string, string> = {
  high: 'bz-badge-ok',
  medium: 'bz-badge-warn',
  low: 'bz-badge-gray',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: '优先推荐',
  medium: '一般推荐',
  low: '备选',
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--bz-ok)';
  if (score >= 60) return 'var(--bz-gold)';
  return 'var(--bz-text-muted)';
}

export function ServiceMatchPanel({ enterpriseId }: ServiceMatchPanelProps) {
  const [items, setItems] = React.useState<ServiceMatchItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasMatched, setHasMatched] = React.useState(false);

  const handleMatch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/enterprises/${enterpriseId}/service-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setItems(json.data ?? []);
      } else {
        setItems([]);
      }
      setHasMatched(true);
    } catch {
      setItems([]);
      setHasMatched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
      <div className="bz-card-head">
        <span className="bz-card-title">
          <Handshake className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
          服务匹配
        </span>
        {!hasMatched && (
          <button
            className="bz-btn bz-btn-primary text-[12px]"
            onClick={handleMatch}
            disabled={loading}
          >
            {loading ? '匹配中…' : '开始匹配'}
          </button>
        )}
      </div>
      <div className="p-4">
        {!hasMatched && !loading && (
          <div className="text-center py-6">
            <p className="text-[13px] text-[var(--bz-text-muted)] mb-3">
              点击"开始匹配"，根据企业金融需求识别结果，智能匹配银行金融产品
            </p>
            <p className="text-[12px] text-[var(--bz-text-muted)]">
              需先完成"金融需求识别"分析，匹配结果将基于需求类型与产品类别进行智能推荐
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
            <span className="ml-2 text-[13px] text-[var(--bz-text-muted)]">正在匹配金融产品…</span>
          </div>
        )}

        {hasMatched && !loading && items.length === 0 && (
          <div className="text-center py-6">
            <p className="text-[13px] text-[var(--bz-text-muted)]">
              暂无匹配的金融产品，请先完成"金融需求识别"分析
            </p>
          </div>
        )}

        {hasMatched && !loading && items.length > 0 && (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div
                key={item.productId}
                className="rounded border p-3"
                style={{ borderColor: 'var(--bz-line)', borderRadius: 6 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-[var(--bz-text)]">
                      {item.productName}
                    </span>
                    <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
                      {item.productCategory}
                    </span>
                  </div>
                  <span className={`bz-badge ${PRIORITY_VARIANT[item.priority] ?? 'bz-badge-gray'}`}>
                    {PRIORITY_LABEL[item.priority] ?? item.priority}
                  </span>
                </div>

                {/* 匹配度进度条 */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-[var(--bz-text-muted)]">匹配度</span>
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: getScoreColor(item.matchScore) }}
                    >
                      {item.matchScore}分
                    </span>
                  </div>
                  <div
                    className="h-[6px] rounded-full overflow-hidden"
                    style={{ background: '#eef2f6' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.matchScore}%`,
                        background: getScoreColor(item.matchScore),
                      }}
                    />
                  </div>
                </div>

                {/* 匹配理由 */}
                <div className="rounded px-3 py-2 mb-2" style={{ background: '#fafbfd', borderRadius: 4 }}>
                  <span className="text-[12px] text-[var(--bz-text-sub)]">{item.matchReason}</span>
                </div>

                {/* 产品详情 */}
                <div className="flex items-center gap-4 text-[12px] text-[var(--bz-text-muted)]">
                  {item.rateRange && (
                    <span>利率：{item.rateRange}</span>
                  )}
                  {item.termRange && (
                    <span>期限：{item.termRange}</span>
                  )}
                  {item.description && (
                    <span className="truncate">{item.description}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}