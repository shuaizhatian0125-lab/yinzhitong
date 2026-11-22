'use client';

import * as React from 'react';
import { FileText, CheckCircle2, ArrowRight } from 'lucide-react';

type AiResultCardProps = {
  result: Record<string, unknown>;
  conclusion?: string;
  evidence?: string[];
  suggestedActions?: string[];
  onToTask?: () => void;
  onToDocument?: () => void;
  className?: string;
};

export function AiResultCard({
  result,
  conclusion,
  evidence,
  suggestedActions,
  onToTask,
  onToDocument,
  className,
}: AiResultCardProps) {
  const [showDetail, setShowDetail] = React.useState(false);

  const conclusionText = conclusion ?? (typeof result.conclusion === 'string' ? result.conclusion : null);
  const evidenceList = evidence ?? (Array.isArray(result.evidence) ? (result.evidence as string[]) : []);
  const actionList = suggestedActions ?? (Array.isArray(result.suggestedActions) ? (result.suggestedActions as string[]) : []);

  return (
    <div
      className={`bz-shadow-soft ${className ?? ''}`}
      style={{
        borderRadius: 6,
        border: '1px solid var(--bz-line)',
        background: '#fafcfe',
      }}
    >
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--bz-line)' }}>
        <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--bz-ok)' }} />
        <span className="text-[14px] font-medium text-[var(--bz-text)]">AI 分析结果</span>
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">
        {conclusionText && (
          <div>
            <span className="text-[12px] font-medium text-[var(--bz-brand)]">结论</span>
            <p className="text-[13px] text-[var(--bz-text)] leading-relaxed mt-1">{conclusionText}</p>
          </div>
        )}

        {evidenceList.length > 0 && (
          <div>
            <span className="text-[12px] font-medium text-[var(--bz-brand)]">依据</span>
            <ul className="mt-1 flex flex-col gap-1">
              {evidenceList.map((item, idx) => (
                <li key={idx} className="text-[13px] text-[var(--bz-text-sub)] leading-relaxed flex items-start gap-2">
                  <span className="text-[var(--bz-text-muted)] shrink-0">{idx + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actionList.length > 0 && (
          <div>
            <span className="text-[12px] font-medium text-[var(--bz-brand)]">建议行动</span>
            <ul className="mt-1 flex flex-col gap-1">
              {actionList.map((item, idx) => (
                <li key={idx} className="text-[13px] text-[var(--bz-text-sub)] leading-relaxed flex items-start gap-2">
                  <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" style={{ color: 'var(--bz-brand)' }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={() => setShowDetail((v) => !v)}
          className="text-[12px] text-[var(--bz-text-muted)] hover:text-[var(--bz-brand)] self-start"
        >
          {showDetail ? '收起原始数据' : '查看原始数据'}
        </button>

        {showDetail && (
          <pre
            className="text-[12px] text-[var(--bz-text-sub)] overflow-auto p-3 rounded"
            style={{ background: 'var(--bz-bg)', borderRadius: 3, maxHeight: 200 }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        {(onToTask || onToDocument) && (
          <div className="flex items-center gap-2 pt-1">
            {onToTask && (
              <button
                onClick={onToTask}
                className="bz-btn bz-btn-ghost text-[12px] flex items-center gap-1"
              >
                <ArrowRight className="h-3 w-3" />
                转为任务
              </button>
            )}
            {onToDocument && (
              <button
                onClick={onToDocument}
                className="bz-btn bz-btn-ghost text-[12px] flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                转为文档
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}