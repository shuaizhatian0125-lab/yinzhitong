'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, PlugZap } from 'lucide-react';
import {
  ACCESS_METHOD_LABEL,
  CONNECTOR_STATUS_LABEL,
  SIGNAL_TYPE_LABEL,
  SOURCE_TIER_LABEL,
  badgeOf,
  labelOf,
} from '@/lib/tvd-labels';

type ConnectorRow = {
  id: string;
  name: string;
  org: string;
  tier: string;
  access_method: string;
  status: string;
  signal_types: string[];
  requires: string[];
  reachable: boolean;
  note: string;
};

type ConnectorPayload = {
  connectors: ConnectorRow[];
  covered_signal_types: string[];
  gaps: string[];
};

/**
 * 数据源接入状态。
 *
 * 演示项目最容易挨的质疑是"这些数字哪来的"。把每个源的接入状态、
 * 覆盖的信号类型、以及没接的原因摊在这里，比在页脚写一句"数据仅供参考"有用。
 */
export function ConnectorStatusPanel() {
  const [data, setData] = React.useState<ConnectorPayload | null>(null);
  const [open, setOpen] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/v1/tvd/connectors', {
          headers: { Authorization: `Bearer ${window.localStorage.getItem('access_token') ?? ''}` },
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.code === 0 && json.data) setData(json.data as ConnectorPayload);
        else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div className="bz-card rounded-[6px] px-4 py-3 text-[12px] text-[var(--bz-text-muted)]">
        数据源接入状态暂时读不到，不影响企业列表浏览。
      </div>
    );
  }

  if (!data) return null;

  const readyCount = data.connectors.filter((c) => c.status === 'available').length;

  return (
    <div className="bz-card rounded-[6px]">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-[14px] font-semibold">
          <PlugZap className="w-4 h-4" style={{ color: 'var(--bz-brand)' }} />
          数据源接入状态
        </span>
        <span className="flex items-center gap-3 text-[12px] text-[var(--bz-text-muted)]">
          <span>
            已接入 {readyCount} / {data.connectors.length} 个源
          </span>
          <span>
            信号维度覆盖 {data.covered_signal_types.length} / {data.covered_signal_types.length + data.gaps.length}
          </span>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[var(--bz-text-sub)] border-b border-[var(--bz-line)]">
                <th className="py-2 pr-3 font-medium">数据源</th>
                <th className="py-2 pr-3 font-medium">状态</th>
                <th className="py-2 pr-3 font-medium">层级 / 方式</th>
                <th className="py-2 pr-3 font-medium">覆盖信号</th>
                <th className="py-2 font-medium">接入条件 / 未接入原因</th>
              </tr>
            </thead>
            <tbody>
              {data.connectors.map((c) => {
                const st = badgeOf(CONNECTOR_STATUS_LABEL, c.status);
                return (
                  <tr key={c.id} className="border-b border-[var(--bz-line)] last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <div>{c.name}</div>
                      <div className="text-[12px] text-[var(--bz-text-muted)]">{c.org}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`bz-badge ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="py-2 pr-3 text-[12px] text-[var(--bz-text-sub)] whitespace-nowrap">
                      {labelOf(SOURCE_TIER_LABEL, c.tier)}
                      <br />
                      {labelOf(ACCESS_METHOD_LABEL, c.access_method)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="flex flex-wrap gap-1">
                        {c.signal_types.map((t) => (
                          <span key={t} className="bz-badge bz-badge-gray">
                            {labelOf(SIGNAL_TYPE_LABEL, t)}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-2 text-[12px] text-[var(--bz-text-sub)]">
                      <div>{c.note}</div>
                      {c.requires.length > 0 && (
                        <ul className="list-disc pl-4 mt-1 text-[var(--bz-text-muted)]">
                          {c.requires.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data.gaps.length > 0 && (
            <p className="text-[12px] text-[var(--bz-text-muted)] mt-3">
              未覆盖维度：
              {data.gaps.map((g) => labelOf(SIGNAL_TYPE_LABEL, g)).join('、')}
              —— 这些维度在库里没有可信来源，评分时按缺失处理而不是 0 分。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
