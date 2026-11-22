'use client';

import * as React from 'react';
import { Sparkles, PanelRightClose, PanelRightOpen } from 'lucide-react';

type DocumentToolbarProps = {
  onAiGenerate: (action: string, extra?: Record<string, unknown>) => void;
  aiGenerating: boolean;
  showAiPanel: boolean;
  onToggleAiPanel: () => void;
};

export function DocumentToolbar({
  onAiGenerate,
  aiGenerating,
  showAiPanel,
  onToggleAiPanel,
}: DocumentToolbarProps) {
  return (
    <div
      className="bz-card flex items-center gap-2 px-3 py-2"
      style={{ borderRadius: 4 }}
    >
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
        <span className="text-[12px] font-medium" style={{ color: 'var(--bz-brand)' }}>
          AI 工具
        </span>
      </div>

      <div className="h-4 w-px" style={{ background: 'var(--bz-line)' }} />

      <button
        onClick={() => onAiGenerate('outline')}
        disabled={aiGenerating}
        className="bz-btn bz-btn-ghost text-[12px]"
        style={{ borderRadius: 4 }}
      >
        生成大纲
      </button>

      <button
        onClick={() => onAiGenerate('section', { sectionIndex: 0 })}
        disabled={aiGenerating}
        className="bz-btn bz-btn-ghost text-[12px]"
        style={{ borderRadius: 4 }}
      >
        生成章节
      </button>

      <div className="h-4 w-px" style={{ background: 'var(--bz-line)' }} />

      <span className="text-[11px] text-[var(--bz-text-muted)]">
        选中文字后使用AI助手进行润色/续写/扩写等操作
      </span>

      <div className="ml-auto">
        <button
          onClick={onToggleAiPanel}
          className="bz-btn bz-btn-ghost flex items-center gap-1 text-[12px]"
          style={{ borderRadius: 4 }}
        >
          {showAiPanel ? (
            <>
              <PanelRightClose className="h-3.5 w-3.5" />
              收起AI面板
            </>
          ) : (
            <>
              <PanelRightOpen className="h-3.5 w-3.5" />
              展开AI面板
            </>
          )}
        </button>
      </div>
    </div>
  );
}