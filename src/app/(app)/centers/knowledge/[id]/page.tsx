'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Upload, FileText, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { KnowledgeQuery } from '@/components/domain/KnowledgeQuery';

type KnowledgeDoc = {
  id: string;
  title: string;
  status: string;
  chunkCount: number;
  error: string | null;
  sourceType: string;
  createdAt: string;
};

type KnowledgeBase = {
  id: string;
  name: string;
  description: string | null;
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  ready: <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--bz-ok)' }} />,
  pending: <Clock className="h-4 w-4" style={{ color: 'var(--bz-warn)' }} />,
  partial: <AlertCircle className="h-4 w-4" style={{ color: 'var(--bz-warn)' }} />,
  failed: <AlertCircle className="h-4 w-4" style={{ color: 'var(--bz-danger)' }} />,
};

const STATUS_LABELS: Record<string, string> = {
  ready: '已就绪',
  pending: '处理中',
  partial: '部分就绪',
  failed: '失败',
};

export default function KnowledgeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const kbId = params.id;

  const [kb, setKb] = React.useState<KnowledgeBase | null>(null);
  const [docs, setDocs] = React.useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token') ?? '';
      const [basesRes, docsRes] = await Promise.all([
        fetch('/api/v1/knowledge/bases', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/knowledge/bases/${kbId}/documents`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const basesJson = await basesRes.json();
      if (basesJson.code === 0 && basesJson.data) {
        const found = (basesJson.data as KnowledgeBase[]).find((b) => b.id === kbId);
        if (found) setKb(found);
      }

      const docsJson = await docsRes.json();
      if (docsJson.code === 0 && docsJson.data) {
        setDocs(docsJson.data as KnowledgeDoc[]);
      }
    } catch {
      // 忽略错误
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/v1/knowledge/bases/${kbId}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (json.code === 0) {
        fetchData();
      }
    } catch {
      // 忽略错误
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/centers/knowledge')}
          className="bz-btn bz-btn-ghost flex items-center gap-1 text-[13px]"
          style={{ borderRadius: 8 }}
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <PageHeader
          title={kb?.name ?? '知识库详情'}
          description={kb?.description ?? ''}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 flex flex-col gap-3">
          <div className="bz-card" style={{ borderRadius: 8 }}>
            <div className="bz-card-head">
              <span className="bz-card-title">文档列表</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bz-btn bz-btn-primary flex items-center gap-1.5 text-[12px]"
                style={{ borderRadius: 8 }}
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? '上传中…' : '上传文档'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="p-3">
              {loading ? (
                <div className="py-6 text-center">
                  <span className="text-[13px] text-[var(--bz-text-muted)]">加载中…</span>
                </div>
              ) : docs.length === 0 ? (
                <div className="py-6 text-center">
                  <FileText
                    className="mx-auto mb-2 h-8 w-8"
                    style={{ color: 'var(--bz-text-muted)' }}
                  />
                  <span className="text-[13px] text-[var(--bz-text-muted)]">
                    暂无文档，上传文档后将自动解析和切片
                  </span>
                </div>
              ) : (
                docs.map((doc, idx) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded transition-colors hover:bg-[#fafcfe]"
                    style={{
                      borderBottom: idx < docs.length - 1 ? '1px solid #eef2f6' : 'none',
                    }}
                  >
                    {STATUS_ICONS[doc.status] ?? (
                      <Clock className="h-4 w-4" style={{ color: 'var(--bz-text-muted)' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] text-[var(--bz-text)] truncate block">
                        {doc.title}
                      </span>
                      {doc.error && (
                        <span className="text-[11px] text-[var(--bz-danger)] truncate block">
                          {doc.error}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--bz-text-muted)] shrink-0">
                      {STATUS_LABELS[doc.status] ?? doc.status}
                    </span>
                    {doc.chunkCount > 0 && (
                      <span className="text-[11px] text-[var(--bz-text-muted)] shrink-0">
                        {doc.chunkCount}切片
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-1">
          <KnowledgeQuery kbId={kbId} />
        </div>
      </div>
    </div>
  );
}