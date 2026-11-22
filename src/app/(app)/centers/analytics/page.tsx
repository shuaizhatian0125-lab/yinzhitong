'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Chart } from '@/components/charts/Chart';
import { GradientHero } from '@/components/domain/GradientHero';
import type { EChartsOption } from 'echarts';

type MetricQueryResult = {
  metricCode: string;
  metricName: string;
  value: number;
  unit: string;
  period: string;
  dataSource: string;
  dataSourceLabel: string;
  dimensions: Record<string, string>;
  trend: { period: string; value: number }[];
};

type MultiDimensionResult = {
  dimension: string;
  items: { dimensionValue: string; metrics: Record<string, number> }[];
  dataSource: string;
  dataSourceLabel: string;
};

type AnomalyAttributionResult = {
  metricCode: string;
  metricName: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  deviationRate: number;
  severity: 'low' | 'medium' | 'high';
  factors: {
    factorName: string;
    contribution: number;
    contributionRate: number;
    description: string;
    dataSource: string;
  }[];
  dataSource: string;
  dataSourceLabel: string;
};

type MetricInfo = {
  code: string;
  name: string;
  domain: string;
  unit: string;
};

type DimensionInfo = {
  code: string;
  name: string;
};

const DATA_SOURCE_VARIANT: Record<string, string> = {
  actual: 'bz-badge-ok',
  mock: 'bz-badge-gold',
  user_input: 'bz-badge-blue',
  external_public: 'bz-badge-blue',
  ai_inferred: 'bz-badge-warn',
};

const SEVERITY_VARIANT: Record<string, string> = {
  low: 'bz-badge-ok',
  medium: 'bz-badge-warn',
  high: 'bz-badge-danger',
};

const SEVERITY_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

function buildTrendChartOption(result: MetricQueryResult): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: result.trend.map((t) => t.period),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#8a97a8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#8a97a8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#eef2f6' } },
    },
    series: [
      {
        type: 'line',
        data: result.trend.map((t) => t.value),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#cc0000', width: 2 },
        itemStyle: { color: '#cc0000' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(204, 0, 0,0.15)' },
              { offset: 1, color: 'rgba(204, 0, 0,0.01)' },
            ],
          },
        },
      },
    ],
  };
}

function buildMultiDimChartOption(result: MultiDimensionResult, metricCodes: string[]): EChartsOption {
  const dimensions = result.items.map((i) => i.dimensionValue);
  const colors = ['#cc0000', '#e02b2b', '#55677a', '#b08a4a', '#1e7b4f'];
  const series: EChartsOption['series'] = metricCodes.map((code, idx) => ({
    name: code,
    type: 'bar' as const,
    data: result.items.map((i) => i.metrics[code] ?? 0),
    itemStyle: {
      color: colors[idx % colors.length],
      borderRadius: [2, 2, 0, 0],
    },
    barWidth: 16,
  }));

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dimensions,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#8a97a8', fontSize: 11, rotate: 15 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#8a97a8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#eef2f6' } },
    },
    series,
    legend: {
      data: metricCodes,
      bottom: 0,
      textStyle: { color: '#8a97a8', fontSize: 11 },
    },
  };
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = React.useState<MetricInfo[]>([]);
  const [dimensions, setDimensions] = React.useState<DimensionInfo[]>([]);
  const [selectedMetric, setSelectedMetric] = React.useState('');
  const [selectedDimension, setSelectedDimension] = React.useState('department');
  const [multiDimMetrics, setMultiDimMetrics] = React.useState<string[]>([]);
  const [metricResult, setMetricResult] = React.useState<MetricQueryResult | null>(null);
  const [multiDimResult, setMultiDimResult] = React.useState<MultiDimensionResult | null>(null);
  const [anomalyResult, setAnomalyResult] = React.useState<AnomalyAttributionResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<'query' | 'multi_dim' | 'anomaly'>('query');

  React.useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [metricsRes, dimsRes] = await Promise.all([
          fetch('/api/v1/analytics?action=metrics_list'),
          fetch('/api/v1/analytics?action=dimensions_list'),
        ]);
        const metricsJson = await metricsRes.json();
        const dimsJson = await dimsRes.json();
        if (metricsJson.code === 0 && metricsJson.data) {
          setMetrics(metricsJson.data);
          if (metricsJson.data.length > 0) {
            setSelectedMetric(metricsJson.data[0].code);
          }
        }
        if (dimsJson.code === 0 && dimsJson.data) {
          setDimensions(dimsJson.data);
        }
      } catch {
        // ignore
      }
    };
    fetchMeta();
  }, []);

  const handleQueryMetric = React.useCallback(async () => {
    if (!selectedMetric) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/analytics?metric_code=${selectedMetric}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setMetricResult(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedMetric]);

  const handleMultiDim = React.useCallback(async () => {
    if (multiDimMetrics.length === 0) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'multi_dimension',
        dimension: selectedDimension,
        metric_codes: multiDimMetrics.join(','),
      });
      const res = await fetch(`/api/v1/analytics?${params.toString()}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setMultiDimResult(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedDimension, multiDimMetrics]);

  const handleAnomaly = React.useCallback(async () => {
    if (!selectedMetric) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/analytics?action=anomaly&metric_code=${selectedMetric}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setAnomalyResult(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedMetric]);

  const toggleMultiDimMetric = (code: string) => {
    setMultiDimMetrics((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <GradientHero title="分析中心" subtitle="经营分析、风险分析、客户分析、业务洞察" />

      <div className="flex gap-2">
        <button
          className={`bz-btn ${tab === 'query' ? 'bz-btn-primary' : 'bz-btn-default'}`}
          onClick={() => setTab('query')}
        >
          指标查询
        </button>
        <button
          className={`bz-btn ${tab === 'multi_dim' ? 'bz-btn-primary' : 'bz-btn-default'}`}
          onClick={() => setTab('multi_dim')}
        >
          多维分析
        </button>
        <button
          className={`bz-btn ${tab === 'anomaly' ? 'bz-btn-primary' : 'bz-btn-default'}`}
          onClick={() => setTab('anomaly')}
        >
          异常归因
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {tab === 'query' && (
        <div className="flex flex-col gap-4">
          <div className="bz-card" style={{ borderRadius: 8, padding: '14px 18px' }}>
            <div className="flex items-center gap-3">
              <label className="bz-label" style={{ marginBottom: 0 }}>选择指标</label>
              <select
                className="bz-select"
                style={{ width: 240 }}
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
              >
                {metrics.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.domain})
                  </option>
                ))}
              </select>
              <button className="bz-btn bz-btn-primary" onClick={handleQueryMetric}>
                查询
              </button>
            </div>
          </div>

          {metricResult && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bz-kpi" style={{ borderRadius: 8 }}>
                  <div className="bz-kpi-label">{metricResult.metricName}</div>
                  <div className="bz-kpi-value">
                    {metricResult.value.toLocaleString('zh-CN')}
                    <span className="text-[14px] font-normal text-[var(--bz-text-muted)] ml-1">
                      {metricResult.unit}
                    </span>
                  </div>
                  <div className="bz-kpi-sub">{metricResult.period}</div>
                </div>
                <div className="bz-kpi" style={{ borderRadius: 8 }}>
                  <div className="bz-kpi-label">数据来源</div>
                  <div className="bz-kpi-value" style={{ fontSize: 16 }}>
                    <span className={`bz-badge ${DATA_SOURCE_VARIANT[metricResult.dataSource] ?? 'bz-badge-gray'}`}>
                      {metricResult.dataSourceLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bz-card" style={{ borderRadius: 8 }}>
                <div className="bz-card-head">
                  <span className="bz-card-title">{metricResult.metricName} - 趋势</span>
                  <span className={`bz-badge ${DATA_SOURCE_VARIANT[metricResult.dataSource] ?? 'bz-badge-gray'}`}>
                    {metricResult.dataSourceLabel}
                  </span>
                </div>
                <div className="p-3">
                  <Chart option={buildTrendChartOption(metricResult)} height={260} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'multi_dim' && (
        <div className="flex flex-col gap-4">
          <div className="bz-card" style={{ borderRadius: 8, padding: '14px 18px' }}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <label className="bz-label" style={{ marginBottom: 0 }}>分析维度</label>
                <select
                  className="bz-select"
                  style={{ width: 200 }}
                  value={selectedDimension}
                  onChange={(e) => setSelectedDimension(e.target.value)}
                >
                  {dimensions.map((d) => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="bz-label" style={{ marginBottom: 0 }}>选择指标</label>
                {metrics.map((m) => (
                  <button
                    key={m.code}
                    className={`bz-btn ${multiDimMetrics.includes(m.code) ? 'bz-btn-primary' : 'bz-btn-default'}`}
                    style={{ height: 26, fontSize: 12, padding: '0 10px' }}
                    onClick={() => toggleMultiDimMetric(m.code)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              <button className="bz-btn bz-btn-primary" style={{ alignSelf: 'flex-start' }} onClick={handleMultiDim}>
                分析
              </button>
            </div>
          </div>

          {multiDimResult && (
            <div className="bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">
                  {dimensions.find((d) => d.code === multiDimResult.dimension)?.name ?? multiDimResult.dimension} - 多维分析
                </span>
                <span className={`bz-badge ${DATA_SOURCE_VARIANT[multiDimResult.dataSource] ?? 'bz-badge-gray'}`}>
                  {multiDimResult.dataSourceLabel}
                </span>
              </div>
              <div className="p-3">
                <Chart
                  option={buildMultiDimChartOption(multiDimResult, multiDimMetrics)}
                  height={280}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'anomaly' && (
        <div className="flex flex-col gap-4">
          <div className="bz-card" style={{ borderRadius: 8, padding: '14px 18px' }}>
            <div className="flex items-center gap-3">
              <label className="bz-label" style={{ marginBottom: 0 }}>选择指标</label>
              <select
                className="bz-select"
                style={{ width: 240 }}
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
              >
                {metrics.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.domain})
                  </option>
                ))}
              </select>
              <button className="bz-btn bz-btn-primary" onClick={handleAnomaly}>
                归因分析
              </button>
            </div>
          </div>

          {anomalyResult && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bz-kpi" style={{ borderRadius: 8 }}>
                  <div className="bz-kpi-label">当前值</div>
                  <div className="bz-kpi-value">
                    {anomalyResult.currentValue.toLocaleString('zh-CN')}
                  </div>
                </div>
                <div className="bz-kpi" style={{ borderRadius: 8 }}>
                  <div className="bz-kpi-label">预期值</div>
                  <div className="bz-kpi-value">
                    {anomalyResult.expectedValue.toLocaleString('zh-CN')}
                  </div>
                </div>
                <div className="bz-kpi" style={{ borderRadius: 8 }}>
                  <div className="bz-kpi-label">偏差率</div>
                  <div className="bz-kpi-value" style={{
                    color: anomalyResult.deviationRate > 0 ? 'var(--bz-ok)' : 'var(--bz-danger)',
                  }}>
                    {anomalyResult.deviationRate > 0 ? '+' : ''}{anomalyResult.deviationRate}%
                  </div>
                </div>
                <div className="bz-kpi" style={{ borderRadius: 8 }}>
                  <div className="bz-kpi-label">异常级别</div>
                  <div className="bz-kpi-value" style={{ fontSize: 18 }}>
                    <span className={`bz-badge ${SEVERITY_VARIANT[anomalyResult.severity]}`}>
                      {SEVERITY_LABEL[anomalyResult.severity]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bz-card" style={{ borderRadius: 8 }}>
                <div className="bz-card-head">
                  <span className="bz-card-title">归因因素分析</span>
                  <span className={`bz-badge ${DATA_SOURCE_VARIANT[anomalyResult.dataSource] ?? 'bz-badge-gray'}`}>
                    {anomalyResult.dataSourceLabel}
                  </span>
                </div>
                <div className="bz-scroll">
                  <table className="bz-table">
                    <thead>
                      <tr>
                        <th>因素</th>
                        <th>贡献度</th>
                        <th>贡献率</th>
                        <th>说明</th>
                        <th>数据来源</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalyResult.factors.map((f, i) => (
                        <tr key={i}>
                          <td className="font-medium">{f.factorName}</td>
                          <td className="num">{f.contribution.toLocaleString('zh-CN')}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bz-line)', width: 60 }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${f.contributionRate}%`, background: 'var(--bz-brand)' }}
                                />
                              </div>
                              <span className="text-[11px]">{f.contributionRate}%</span>
                            </div>
                          </td>
                          <td className="text-[var(--bz-text-sub)]">{f.description}</td>
                          <td>
                            <span className={`bz-badge ${DATA_SOURCE_VARIANT[f.dataSource] ?? 'bz-badge-gray'}`}>
                              {f.dataSource === 'actual' ? '实际数据' :
                                f.dataSource === 'mock' ? '模拟数据' :
                                  f.dataSource === 'ai_inferred' ? 'AI推断' :
                                    f.dataSource === 'external_public' ? '外部公开' : '用户输入'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}