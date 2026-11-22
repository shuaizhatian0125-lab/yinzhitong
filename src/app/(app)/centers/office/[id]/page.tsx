'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, FileText, History, Sparkles, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DocumentEditor } from '@/components/domain/DocumentEditor';
import { DocumentToolbar } from '@/components/domain/DocumentToolbar';

type DocumentInfo = {
  id: string;
  title: string;
  docType: string;
  status: string;
  currentVersionId: string | null;
};

type DocumentContent = {
  blocks: Array<{
    type: string;
    attrs: Record<string, unknown>;
    text: string;
  }>;
  plainText: string;
};

type VersionItem = {
  id: string;
  versionNo: number;
  title: string;
  editorId: string | null;
  changeNote: string | null;
  wordCount: number;
  createdAt: string;
};

type AiPreview = {
  originalText: string;
  modifiedText: string;
  operation: string;
};

export default function DocumentEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const docId = params.id;

  const [doc, setDoc] = React.useState<DocumentInfo | null>(null);
  const [content, setContent] = React.useState<DocumentContent | null>(null);
  const [versions, setVersions] = React.useState<VersionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showVersions, setShowVersions] = React.useState(false);
  const [showAiPanel, setShowAiPanel] = React.useState(true);
  const [aiPreview, setAiPreview] = React.useState<AiPreview | null>(null);
  const [aiGenerating, setAiGenerating] = React.useState(false);
  const [selectedText, setSelectedText] = React.useState('');
  const [aiOperation, setAiOperation] = React.useState<string>('polish');
  const [exportFormat, setExportFormat] = React.useState<string>('pdf');
  const [saveTimer, setSaveTimer] = React.useState<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token') ?? '';
      const [docRes, contentRes, versionsRes] = await Promise.all([
        fetch(`/api/v1/documents/${docId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/documents/${docId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/documents/${docId}/versions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const docJson = await docRes.json();
      if (docJson.code === 0 && docJson.data) {
        setDoc(docJson.data as DocumentInfo);
      }

      const contentJson = await contentRes.json();
      if (contentJson.code === 0 && contentJson.data) {
        setContent(contentJson.data as DocumentContent);
      }

      const versionsJson = await versionsRes.json();
      if (versionsJson.code === 0 && versionsJson.data) {
        setVersions(versionsJson.data as VersionItem[]);
      }
    } catch {
      // 忽略错误
    } finally {
      setLoading(false);
    }
  }, [docId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBlocksChange = (blocks: DocumentContent['blocks']) => {
    if (!content) return;
    setContent({ ...content, blocks });

    if (saveTimer) clearTimeout(saveTimer);
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/v1/documents/${docId}/content`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
          },
          body: JSON.stringify({ blocks }),
        });
      } catch {
        // 忽略错误
      } finally {
        setSaving(false);
      }
    }, 3000);
    setSaveTimer(timer);
  };

  const handleAiGenerate = async (action: string, extra?: Record<string, unknown>) => {
    setAiGenerating(true);
    setAiPreview(null);
    try {
      const res = await fetch(`/api/v1/documents/${docId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        if (action === 'write') {
          setAiPreview({
            originalText: json.data.originalText,
            modifiedText: json.data.modifiedText,
            operation: json.data.operation,
          });
        } else if (action === 'outline') {
          const newBlocks = json.data.blocks;
          if (newBlocks && content) {
            handleBlocksChange(newBlocks);
          }
        } else if (action === 'section') {
          const sectionBlocks = json.data.blocks;
          if (sectionBlocks && content) {
            const allBlocks = [...content.blocks];
            const headingIdx = allBlocks.findIndex(
              (b, i) => b.type === 'heading' && i === (extra?.sectionIndex as number),
            );
            if (headingIdx >= 0) {
              allBlocks.splice(headingIdx + 1, 0, ...sectionBlocks.slice(1));
              handleBlocksChange(allBlocks);
            }
          }
        }
      }
    } catch {
      // 忽略错误
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAcceptAi = () => {
    if (!aiPreview || !content) return;
    const newBlocks = content.blocks.map((block) => {
      if (block.text === aiPreview.originalText) {
        return { ...block, text: aiPreview.modifiedText };
      }
      return block;
    });
    handleBlocksChange(newBlocks);
    setAiPreview(null);
  };

  const handleRejectAi = () => {
    setAiPreview(null);
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/v1/documents/${docId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
        body: JSON.stringify({ format: exportFormat }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const blob = new Blob([json.data.content], { type: json.data.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = json.data.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // 忽略错误
    }
  };

  const handleRestoreVersion = async (versionNo: number) => {
    try {
      const res = await fetch(
        `/api/v1/documents/${docId}/versions/${versionNo}/restore`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
          },
        },
      );
      const json = await res.json();
      if (json.code === 0) {
        fetchData();
        setShowVersions(false);
      }
    } catch {
      // 忽略错误
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="加载中…" description="" />
        <div className="bz-card p-8 text-center" style={{ borderRadius: 8 }}>
          <span className="text-[14px] text-[var(--bz-text-muted)]">加载中…</span>
        </div>
      </div>
    );
  }

  if (!doc || !content) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="文档不存在" description="" />
        <div className="bz-card p-8 text-center" style={{ borderRadius: 8 }}>
          <FileText className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--bz-text-muted)' }} />
          <span className="text-[14px] text-[var(--bz-text-muted)]">文档不存在或已被删除</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/centers/office')}
          className="bz-btn bz-btn-ghost flex items-center gap-1 text-[13px]"
          style={{ borderRadius: 8 }}
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <PageHeader title={doc.title} description="" />
        <div className="flex items-center gap-2 ml-auto">
          {saving && (
            <span className="text-[11px] text-[var(--bz-text-muted)]">自动保存中…</span>
          )}
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="bz-btn bz-btn-ghost flex items-center gap-1 text-[12px]"
            style={{ borderRadius: 8 }}
          >
            <History className="h-3.5 w-3.5" />
            版本
          </button>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="h-7 rounded border px-2 text-[12px] outline-none"
            style={{ borderColor: 'var(--bz-line-strong)', background: 'var(--bz-bg)' }}
          >
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="pptx">PPTX</option>
          </select>
          <button
            onClick={handleExport}
            className="bz-btn bz-btn-ghost flex items-center gap-1 text-[12px]"
            style={{ borderRadius: 8 }}
          >
            <Download className="h-3.5 w-3.5" />
            导出
          </button>
        </div>
      </div>

      <DocumentToolbar
        onAiGenerate={handleAiGenerate}
        aiGenerating={aiGenerating}
        showAiPanel={showAiPanel}
        onToggleAiPanel={() => setShowAiPanel(!showAiPanel)}
      />

      <div className="grid grid-cols-4 gap-3">
        <div className={showAiPanel ? 'col-span-3' : 'col-span-4'}>
          <DocumentEditor
            blocks={content.blocks}
            onChange={handleBlocksChange}
            onTextSelect={setSelectedText}
          />
        </div>

        {showAiPanel && (
          <div className="col-span-1">
            <div className="bz-card flex flex-col" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
                  AI 助手
                </span>
              </div>

              <div className="p-3 flex flex-col gap-3">
                <button
                  onClick={() => handleAiGenerate('outline', { documentType: doc.docType })}
                  disabled={aiGenerating}
                  className="bz-btn bz-btn-primary text-[12px]"
                  style={{ borderRadius: 8 }}
                >
                  生成大纲
                </button>

                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-medium text-[var(--bz-text)]">
                    AI 写作操作
                  </span>
                  <select
                    value={aiOperation}
                    onChange={(e) => setAiOperation(e.target.value)}
                    className="h-8 rounded border px-2 text-[12px] outline-none"
                    style={{ borderColor: 'var(--bz-line-strong)', background: 'var(--bz-bg)' }}
                  >
                    <option value="polish">润色</option>
                    <option value="continue">续写</option>
                    <option value="expand">扩写</option>
                    <option value="condense">缩写</option>
                    <option value="rewrite">改写</option>
                    <option value="adjust_tone">调整语气</option>
                    <option value="correct">纠错</option>
                    <option value="optimize_logic">逻辑优化</option>
                  </select>
                  <textarea
                    value={selectedText}
                    onChange={(e) => setSelectedText(e.target.value)}
                    placeholder="输入或选中文本…"
                    rows={3}
                    className="rounded border px-2 py-1.5 text-[12px] outline-none"
                    style={{ borderColor: 'var(--bz-line-strong)', background: 'var(--bz-bg)' }}
                  />
                  <button
                    onClick={() =>
                      handleAiGenerate('write', {
                        operation: aiOperation,
                        selectedText,
                      })
                    }
                    disabled={aiGenerating || !selectedText.trim()}
                    className="bz-btn bz-btn-primary text-[12px]"
                    style={{ borderRadius: 8 }}
                  >
                    {aiGenerating ? '生成中…' : '执行AI操作'}
                  </button>
                </div>

                {aiPreview && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[12px] font-medium text-[var(--bz-text)]">
                      AI 修改预览
                    </span>
                    <div
                      className="rounded px-3 py-2"
                      style={{ background: '#f0fdf4', borderRadius: 6 }}
                    >
                      <span className="text-[11px]" style={{ color: '#166534' }}>
                        修改后:
                      </span>
                      <p className="text-[12px] text-[var(--bz-text)] mt-1 whitespace-pre-wrap">
                        {aiPreview.modifiedText}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAcceptAi}
                        className="bz-btn bz-btn-primary flex-1 text-[12px]"
                        style={{ borderRadius: 8 }}
                      >
                        接受
                      </button>
                      <button
                        onClick={handleRejectAi}
                        className="bz-btn bz-btn-ghost flex-1 text-[12px]"
                        style={{ borderRadius: 8 }}
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showVersions && (
        <div className="bz-card" style={{ borderRadius: 8 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">版本历史</span>
            <button
              onClick={() => setShowVersions(false)}
              className="bz-btn bz-btn-ghost text-[12px]"
            >
              关闭
            </button>
          </div>
          <div className="p-3">
            {versions.map((v, idx) => (
              <div
                key={v.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded"
                style={{
                  borderBottom: idx < versions.length - 1 ? '1px solid #eef2f6' : 'none',
                }}
              >
                <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
                  v{v.versionNo}
                </span>
                <span className="text-[13px] text-[var(--bz-text)] flex-1 truncate">
                  {v.changeNote ?? v.title}
                </span>
                <span className="text-[11px] text-[var(--bz-text-muted)]">
                  {v.wordCount}字
                </span>
                <span className="text-[11px] text-[var(--bz-text-muted)]">
                  {new Date(v.createdAt).toLocaleString('zh-CN')}
                </span>
                <button
                  onClick={() => handleRestoreVersion(v.versionNo)}
                  className="bz-btn bz-btn-ghost text-[12px]"
                  style={{ borderRadius: 8 }}
                >
                  恢复
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}