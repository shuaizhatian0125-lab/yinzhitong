'use client';

import * as React from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Loader2 } from 'lucide-react';

type FeedbackType = 'like' | 'dislike' | 'text';

type Evaluation = {
  accuracy: number;
  completeness: number;
  relevance: number;
  efficiency: number;
  safety: number;
};

type QualityFeedbackProps = {
  runId: string;
  stepId?: string;
  onFeedback?: (type: FeedbackType, text?: string) => void;
  className?: string;
};

export function QualityFeedback({
  runId,
  stepId,
  onFeedback,
  className,
}: QualityFeedbackProps) {
  const [submitted, setSubmitted] = React.useState<FeedbackType | null>(null);
  const [showTextInput, setShowTextInput] = React.useState(false);
  const [textValue, setTextValue] = React.useState('');
  const [evaluation, setEvaluation] = React.useState<Evaluation | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (type: FeedbackType) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          stepId,
          type,
          text: type === 'text' ? textValue : undefined,
        }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.evaluation) {
        setEvaluation(json.data.evaluation);
      }
      setSubmitted(type);
      onFeedback?.(type, type === 'text' ? textValue : undefined);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const EVAL_LABELS: Record<keyof Evaluation, string> = {
    accuracy: '准确性',
    completeness: '完整性',
    relevance: '相关性',
    efficiency: '效率',
    safety: '安全性',
  };

  return (
    <div className={`rounded-[4px] border border-[var(--bz-border)] bg-[var(--bz-card)] p-3 ${className ?? ''}`}>
      {!submitted && !showTextInput && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--bz-text-sub)] mr-1">反馈：</span>
          <button
            onClick={() => handleSubmit('like')}
            disabled={loading}
            className="flex items-center gap-1 text-[12px] px-2 py-1 rounded transition-colors hover:bg-[var(--bz-ok-tint)]"
            style={{ borderRadius: 2, color: 'var(--bz-ok)' }}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            有帮助
          </button>
          <button
            onClick={() => handleSubmit('dislike')}
            disabled={loading}
            className="flex items-center gap-1 text-[12px] px-2 py-1 rounded transition-colors hover:bg-[var(--bz-danger-tint)]"
            style={{ borderRadius: 2, color: 'var(--bz-danger)' }}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            需改进
          </button>
          <button
            onClick={() => setShowTextInput(true)}
            disabled={loading}
            className="flex items-center gap-1 text-[12px] px-2 py-1 rounded transition-colors hover:bg-[var(--bz-brand-tint)]"
            style={{ borderRadius: 2, color: 'var(--bz-brand)' }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            文字反馈
          </button>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--bz-text-muted)]" />}
        </div>
      )}

      {showTextInput && !submitted && (
        <div className="flex flex-col gap-2">
          <textarea
            placeholder="请输入您的反馈..."
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            className="text-[13px] px-3 py-2 rounded border"
            style={{ borderColor: 'var(--bz-border)', borderRadius: 3, minHeight: 60 }}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSubmit('text')}
              disabled={loading || !textValue.trim()}
              className="bz-btn bz-btn-primary text-[12px]"
              style={{ borderRadius: 2 }}
            >
              {loading ? '提交中...' : '提交反馈'}
            </button>
            <button
              onClick={() => setShowTextInput(false)}
              className="bz-btn bz-btn-ghost text-[12px]"
              style={{ borderRadius: 2 }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {submitted && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {submitted === 'like' && <ThumbsUp className="h-4 w-4" style={{ color: 'var(--bz-ok)' }} />}
            {submitted === 'dislike' && <ThumbsDown className="h-4 w-4" style={{ color: 'var(--bz-danger)' }} />}
            {submitted === 'text' && <MessageSquare className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />}
            <span className="text-[13px] text-[var(--bz-text)]">
              {submitted === 'like' ? '感谢您的肯定' : submitted === 'dislike' ? '感谢您的反馈，我们会改进' : '反馈已提交'}
            </span>
          </div>

          {evaluation && (
            <div className="grid grid-cols-5 gap-2 mt-1">
              {(Object.keys(EVAL_LABELS) as (keyof Evaluation)[]).map((key) => (
                <div
                  key={key}
                  className="rounded px-2 py-1.5 text-center"
                  style={{ background: 'var(--bz-brand-tint)', borderRadius: 2 }}
                >
                  <div className="text-[11px] text-[var(--bz-text-sub)] mb-0.5">{EVAL_LABELS[key]}</div>
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--bz-brand)' }}>
                    {evaluation[key].toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}