'use client';

import * as React from 'react';

type Block = {
  type: string;
  attrs: Record<string, unknown>;
  text: string;
};

type DocumentEditorProps = {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  onTextSelect?: (text: string) => void;
};

const BLOCK_LABELS: Record<string, string> = {
  heading: '标题',
  paragraph: '段落',
  list: '列表',
  table: '表格',
  image: '图片',
  chart: '图表',
  quote: '引用',
  code: '代码',
};

export function DocumentEditor({ blocks, onChange, onTextSelect }: DocumentEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [focusedIdx, setFocusedIdx] = React.useState<number | null>(null);

  const handleTextChange = (idx: number, text: string) => {
    const newBlocks = [...blocks];
    newBlocks[idx] = { ...newBlocks[idx], text };
    onChange(newBlocks);
  };

  const handleAddBlock = (idx: number, type: string) => {
    const newBlock: Block = {
      type,
      attrs: type === 'heading' ? { level: 2 } : {},
      text: '',
    };
    const newBlocks = [...blocks];
    newBlocks.splice(idx + 1, 0, newBlock);
    onChange(newBlocks);
  };

  const handleDeleteBlock = (idx: number) => {
    if (blocks.length <= 1) return;
    const newBlocks = blocks.filter((_, i) => i !== idx);
    onChange(newBlocks);
  };

  const handleTypeChange = (idx: number, type: string) => {
    const newBlocks = [...blocks];
    const attrs = type === 'heading' ? { level: 2 } : {};
    newBlocks[idx] = { ...newBlocks[idx], type, attrs };
    onChange(newBlocks);
  };

  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      onTextSelect?.(selection.toString());
    }
  };

  return (
    <div
      className="bz-card bz-shadow-soft"
      style={{ borderRadius: 8 }}
      ref={editorRef}
      onMouseUp={handleTextSelect}
    >
      <div className="bz-card-head">
        <span className="bz-card-title">文档编辑器</span>
        <span className="text-[12px] text-[var(--bz-text-muted)]">
          {blocks.length} 个块
        </span>
      </div>
      <div className="p-4">
        {blocks.map((block, idx) => (
          <div
            key={idx}
            className="group relative flex items-start gap-2 py-1.5"
            onFocus={() => setFocusedIdx(idx)}
          >
            <div className="flex flex-col items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <select
                value={block.type}
                onChange={(e) => handleTypeChange(idx, e.target.value)}
                className="h-6 rounded border px-1 text-[10px] outline-none"
                style={{
                  borderColor: 'var(--bz-line)',
                  background: 'var(--bz-bg)',
                  width: 60,
                }}
              >
                {Object.entries(BLOCK_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleDeleteBlock(idx)}
                className="text-[10px] text-[var(--bz-danger)] hover:underline"
                style={{ width: 60 }}
              >
                删除
              </button>
            </div>

            <div className="flex-1 min-w-0">
              {block.type === 'heading' ? (
                <input
                  value={block.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder="标题内容…"
                  className="w-full bg-transparent font-bold text-[16px] outline-none text-[var(--bz-text)]"
                  style={{
                    fontSize: `${Math.max(12, 24 - ((block.attrs.level as number) ?? 2) * 2)}px`,
                  }}
                />
              ) : block.type === 'quote' ? (
                <textarea
                  value={block.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder="引用内容…"
                  rows={2}
                  className="w-full bg-transparent text-[14px] outline-none text-[var(--bz-text)]"
                  style={{
                    borderLeft: '3px solid var(--bz-brand)',
                    paddingLeft: 12,
                    fontStyle: 'italic',
                  }}
                />
              ) : block.type === 'code' ? (
                <textarea
                  value={block.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder="代码内容…"
                  rows={4}
                  className="w-full bg-transparent text-[13px] outline-none font-mono text-[var(--bz-text)]"
                  style={{
                    background: '#1a1a2e',
                    color: '#e2e8f0',
                    borderRadius: 4,
                    padding: 12,
                  }}
                />
              ) : block.type === 'list' ? (
                <textarea
                  value={block.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder="列表项（每行一项）…"
                  rows={3}
                  className="w-full bg-transparent text-[14px] outline-none text-[var(--bz-text)]"
                  style={{ paddingLeft: 20 }}
                />
              ) : block.type === 'table' ? (
                <textarea
                  value={block.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder="表格内容（用|分隔列，每行一行）…"
                  rows={4}
                  className="w-full bg-transparent text-[13px] outline-none text-[var(--bz-text)]"
                />
              ) : block.type === 'image' ? (
                <input
                  value={block.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder="图片URL…"
                  className="w-full bg-transparent text-[14px] outline-none text-[var(--bz-text)]"
                />
              ) : block.type === 'chart' ? (
                <input
                  value={block.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder="图表描述…"
                  className="w-full bg-transparent text-[14px] outline-none text-[var(--bz-text)]"
                />
              ) : (
                <textarea
                  value={block.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder="段落内容…"
                  rows={2}
                  className="w-full bg-transparent text-[14px] outline-none text-[var(--bz-text)] leading-relaxed"
                  style={{ resize: 'vertical' }}
                />
              )}
            </div>

            <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => handleAddBlock(idx, 'paragraph')}
                className="text-[10px] text-[var(--bz-brand)] hover:underline"
              >
                +段落
              </button>
              <button
                onClick={() => handleAddBlock(idx, 'heading')}
                className="text-[10px] text-[var(--bz-brand)] hover:underline"
              >
                +标题
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}