'use client';

import { useRouter } from 'next/navigation';

export type EnterpriseMatchCardData = {
  id: string;
  name: string;
  industry: string | null;
  region: string | null;
  scale: string | null;
  matchScore: number;
  matchReason: string;
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--bz-ok)';
  if (score >= 60) return 'var(--bz-gold)';
  if (score >= 40) return 'var(--bz-info)';
  return 'var(--bz-text-muted)';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '高度匹配';
  if (score >= 60) return '较好匹配';
  if (score >= 40) return '一般匹配';
  return '弱匹配';
}

export function EnterpriseMatchCard({ data }: { data: EnterpriseMatchCardData }) {
  const router = useRouter();

  return (
    <div
      className="bz-card bz-shadow-soft cursor-pointer transition-all hover:shadow-md"
      style={{ borderRadius: 6 }}
      onClick={() => router.push(`/centers/enterprise/${data.id}`)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[15px] font-medium text-[var(--bz-text)]">{data.name}</span>
          <span
            className="bz-badge"
            style={{
              background: `${getScoreColor(data.matchScore)}15`,
              color: getScoreColor(data.matchScore),
              fontSize: 12,
            }}
          >
            {getScoreLabel(data.matchScore)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-[var(--bz-text-sub)] mb-3">
          <span>{data.industry ?? '待补充'}</span>
          <span>·</span>
          <span>{data.region ?? '待补充'}</span>
          {data.scale && (
            <>
              <span>·</span>
              <span>{data.scale}</span>
            </>
          )}
        </div>

        {/* 匹配度进度条 */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-[var(--bz-text-muted)]">匹配度</span>
            <span className="text-[12px] font-medium" style={{ color: getScoreColor(data.matchScore) }}>
              {data.matchScore}分
            </span>
          </div>
          <div className="h-[6px] rounded-full overflow-hidden" style={{ background: '#eef2f6' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${data.matchScore}%`,
                background: getScoreColor(data.matchScore),
              }}
            />
          </div>
        </div>

        {/* 推荐理由 */}
        <div className="rounded px-3 py-2" style={{ background: '#fafbfd', borderRadius: 4 }}>
          <span className="text-[12px] text-[var(--bz-text-sub)]">{data.matchReason}</span>
        </div>
      </div>
    </div>
  );
}