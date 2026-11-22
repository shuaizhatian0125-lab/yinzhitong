'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Save, Cpu, Bot, Activity } from 'lucide-react';

type ProviderItem = {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  models: unknown[];
  capabilities: string[];
  priority: number;
  status: string;
};

type AgentItem = {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  version: string;
  riskLevel: string;
  status: string;
  tools: string[];
};

type TabKey = 'providers' | 'agents' | 'health';

export default function AiPage() {
  const [tab, setTab] = React.useState<TabKey>('providers');
  const [providers, setProviders] = React.useState<ProviderItem[]>([]);
  const [agents, setAgents] = React.useState<AgentItem[]>([]);
  const [health, setHealth] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadTabData(tab);
  }, [tab]);

  async function loadTabData(currentTab: TabKey) {
    setLoading(true);
    try {
      if (currentTab === 'providers') {
        const res = await fetch('/api/v1/admin/ai/providers');
        const json = await res.json();
        if (json.code === 0 && json.data) setProviders(json.data.items ?? []);
      } else if (currentTab === 'agents') {
        const res = await fetch('/api/v1/admin/ai/agents');
        const json = await res.json();
        if (json.code === 0 && json.data) setAgents(json.data.items ?? []);
      } else if (currentTab === 'health') {
        const res = await fetch('/api/v1/admin/health');
        const json = await res.json();
        if (json.code === 0 && json.data) setHealth(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'providers', label: 'AI 供应商', icon: <Cpu className="h-4 w-4" /> },
    { key: 'agents', label: 'Agent 配置', icon: <Bot className="h-4 w-4" /> },
    { key: 'health', label: '健康检查', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI 配置"
        description="管理 AI 供应商、Agent 定义与系统健康状态"
      />

      <div className="bz-card flex items-center gap-1 px-2 py-1.5" style={{ borderRadius: 6 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded transition-colors ${
              tab === t.key ? 'text-[var(--bz-brand)]' : 'text-[var(--bz-text-sub)]'
            }`}
            style={{
              background: tab === t.key ? 'var(--bz-brand-tint)' : 'transparent',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bz-card p-8 text-center text-[14px] text-[var(--bz-text-muted)]" style={{ borderRadius: 6 }}>
          加载中…
        </div>
      ) : tab === 'providers' ? (
        <div className="bz-card overflow-hidden" style={{ borderRadius: 6 }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: 'var(--bz-brand-tint)', borderBottom: '1px solid var(--bz-line)' }}>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">名称</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">类型</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">Base URL</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">能力</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">优先级</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">状态</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--bz-line)' }}>
                  <td className="px-4 py-2.5 text-[var(--bz-text)]">{p.name}</td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">{p.kind}</td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-muted)] truncate max-w-[200px]">{p.baseUrl}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(p.capabilities ?? []).map((c) => (
                        <span
                          key={c as string}
                          className="px-1.5 py-0.5 text-[12px]"
                          style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)', borderRadius: 6 }}
                        >
                          {c as string}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">{p.priority}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="px-2 py-0.5 text-[12px]"
                      style={{
                        background: p.status === 'active' ? 'rgba(30,123,79,0.1)' : 'rgba(180,35,24,0.1)',
                        color: p.status === 'active' ? 'var(--bz-ok)' : 'var(--bz-danger)',
                        borderRadius: 6,
                      }}
                    >
                      {p.status === 'active' ? '活跃' : '已停用'}
                    </span>
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--bz-text-muted)]">
                    暂无 AI 供应商配置
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === 'agents' ? (
        <div className="bz-card overflow-hidden" style={{ borderRadius: 6 }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: 'var(--bz-brand-tint)', borderBottom: '1px solid var(--bz-line)' }}>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">名称</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">编码</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">模块</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">版本</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">风险等级</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">工具数</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">状态</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--bz-line)' }}>
                  <td className="px-4 py-2.5 text-[var(--bz-text)]">{a.name}</td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">{a.code}</td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">{a.module}</td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-muted)]">{a.version}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="px-2 py-0.5 text-[12px]"
                      style={{
                        background:
                          a.riskLevel === 'L0' ? 'rgba(30,123,79,0.1)' :
                          a.riskLevel === 'L1' ? 'var(--bz-brand-tint)' :
                          a.riskLevel === 'L2' ? 'var(--bz-gold-tint)' :
                          'rgba(180,35,24,0.1)',
                        color:
                          a.riskLevel === 'L0' ? 'var(--bz-ok)' :
                          a.riskLevel === 'L1' ? 'var(--bz-brand)' :
                          a.riskLevel === 'L2' ? 'var(--bz-gold)' :
                          'var(--bz-danger)',
                        borderRadius: 6,
                      }}
                    >
                      {a.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">{(a.tools ?? []).length}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="px-2 py-0.5 text-[12px]"
                      style={{
                        background: a.status === 'active' ? 'rgba(30,123,79,0.1)' : 'rgba(180,35,24,0.1)',
                        color: a.status === 'active' ? 'var(--bz-ok)' : 'var(--bz-danger)',
                        borderRadius: 6,
                      }}
                    >
                      {a.status === 'active' ? '活跃' : '已停用'}
                    </span>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--bz-text-muted)]">
                    暂无 Agent 配置
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bz-card p-4" style={{ borderRadius: 6 }}>
          {health ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
                <span className="text-[15px] font-semibold text-[var(--bz-text)]">系统健康状态</span>
                <span
                  className="px-2 py-0.5 text-[12px]"
                  style={{
                    background:
                      (health.status as string) === 'healthy' ? 'rgba(30,123,79,0.1)' :
                      (health.status as string) === 'degraded' ? 'var(--bz-gold-tint)' :
                      'rgba(180,35,24,0.1)',
                    color:
                      (health.status as string) === 'healthy' ? 'var(--bz-ok)' :
                      (health.status as string) === 'degraded' ? 'var(--bz-gold)' :
                      'var(--bz-danger)',
                    borderRadius: 6,
                  }}
                >
                  {(health.status as string) === 'healthy' ? '健康' :
                   (health.status as string) === 'degraded' ? '降级' : '故障'}
                </span>
              </div>
              <div className="text-[13px] text-[var(--bz-text-muted)]">
                检查时间：{new Date(health.timestamp as string).toLocaleString('zh-CN')}
              </div>

              {Object.entries((health.subsystems as Record<string, Record<string, unknown>>) ?? {}).map(
                ([name, info]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between p-3"
                    style={{ background: 'var(--bz-bg)', borderRadius: 6 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[var(--bz-text)]">
                        {name === 'database' ? '数据库' : name === 'aiGateway' ? 'AI Gateway' : name === 'redis' ? 'Redis' : name}
                      </span>
                      <span
                        className="px-2 py-0.5 text-[12px]"
                        style={{
                          background:
                            (info.status as string) === 'healthy' ? 'rgba(30,123,79,0.1)' :
                            (info.status as string) === 'degraded' ? 'var(--bz-gold-tint)' :
                            'rgba(180,35,24,0.1)',
                          color:
                            (info.status as string) === 'healthy' ? 'var(--bz-ok)' :
                            (info.status as string) === 'degraded' ? 'var(--bz-gold)' :
                            'var(--bz-danger)',
                          borderRadius: 6,
                        }}
                      >
                        {(info.status as string) === 'healthy' ? '健康' :
                         (info.status as string) === 'degraded' ? '降级' : '故障'}
                      </span>
                    </div>
                    <div className="text-[13px] text-[var(--bz-text-muted)]">
                      {info.latencyMs != null ? `${info.latencyMs}ms` : ''} {info.detail as string}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="text-center text-[14px] text-[var(--bz-text-muted)] py-8">
              无法获取健康状态
            </div>
          )}
        </div>
      )}
    </div>
  );
}