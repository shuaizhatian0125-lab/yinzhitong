'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Save, Palette } from 'lucide-react';
import { defaultBrandConfig, type BrandConfig } from '@/server/platform/config/brand';

export default function BrandPage() {
  const [config, setConfig] = React.useState<BrandConfig>(defaultBrandConfig);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/brand');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setConfig(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setConfig(json.data);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="bz-card p-8 text-center text-[14px] text-[var(--bz-text-muted)]" style={{ borderRadius: 6 }}>
        加载中…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="品牌配置"
        description="定制平台品牌名称、Logo、主题色与登录页文案"
        actions={
          <button
            onClick={saveConfig}
            disabled={saving}
            className="bz-btn bz-btn-primary text-[13px] flex items-center gap-1 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? '保存中…' : '保存配置'}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="bz-card p-4 flex flex-col gap-3" style={{ borderRadius: 6 }}>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
            <h3 className="text-[15px] font-semibold text-[var(--bz-text)]">基本信息</h3>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-[var(--bz-text-sub)]">产品名称</span>
            <input
              value={config.productName}
              onChange={(e) => updateField('productName', e.target.value)}
              className="text-[13px] px-3 py-2 outline-none"
              style={{ background: 'var(--bz-bg)', border: '1px solid var(--bz-line)', borderRadius: 6 }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-[var(--bz-text-sub)]">系统标题</span>
            <input
              value={config.systemTitle}
              onChange={(e) => updateField('systemTitle', e.target.value)}
              className="text-[13px] px-3 py-2 outline-none"
              style={{ background: 'var(--bz-bg)', border: '1px solid var(--bz-line)', borderRadius: 6 }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-[var(--bz-text-sub)]">Logo 路径</span>
            <input
              value={config.logo}
              onChange={(e) => updateField('logo', e.target.value)}
              className="text-[13px] px-3 py-2 outline-none"
              style={{ background: 'var(--bz-bg)', border: '1px solid var(--bz-line)', borderRadius: 6 }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-[var(--bz-text-sub)]">品牌主色</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.brandColor}
                onChange={(e) => updateField('brandColor', e.target.value)}
                className="h-8 w-12 rounded-[6px] cursor-pointer"
                style={{ border: '1px solid var(--bz-line)' }}
              />
              <input
                value={config.brandColor}
                onChange={(e) => updateField('brandColor', e.target.value)}
                className="text-[13px] px-3 py-2 outline-none flex-1"
                style={{ background: 'var(--bz-bg)', border: '1px solid var(--bz-line)', borderRadius: 6 }}
              />
            </div>
          </label>
        </div>

        <div className="bz-card p-4 flex flex-col gap-3" style={{ borderRadius: 6 }}>
          <h3 className="text-[15px] font-semibold text-[var(--bz-text)]">登录页文案</h3>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-[var(--bz-text-sub)]">登录页提示语</span>
            <input
              value={config.loginPageText}
              onChange={(e) => updateField('loginPageText', e.target.value)}
              className="text-[13px] px-3 py-2 outline-none"
              style={{ background: 'var(--bz-bg)', border: '1px solid var(--bz-line)', borderRadius: 6 }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-[var(--bz-text-sub)]">欢迎语</span>
            <input
              value={config.welcomeText}
              onChange={(e) => updateField('welcomeText', e.target.value)}
              className="text-[13px] px-3 py-2 outline-none"
              style={{ background: 'var(--bz-bg)', border: '1px solid var(--bz-line)', borderRadius: 6 }}
            />
          </label>

          <div className="mt-2 p-4" style={{ background: 'var(--bz-bg)', borderRadius: 6 }}>
            <div className="text-[12px] text-[var(--bz-text-muted)] mb-2">预览</div>
            <div
              className="p-4 text-center"
              style={{ background: 'var(--bz-surface)', borderRadius: 6, border: '1px solid var(--bz-line)' }}
            >
              <div
                className="text-[18px] font-semibold mb-1"
                style={{ color: config.brandColor }}
              >
                {config.systemTitle}
              </div>
              <div className="text-[13px] text-[var(--bz-text-sub)]">
                {config.loginPageText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}