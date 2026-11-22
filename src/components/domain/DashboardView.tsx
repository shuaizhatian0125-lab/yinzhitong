'use client';

import * as React from 'react';
import { Chart } from '@/components/charts/Chart';
import { MetricTile } from './MetricTile';
import type { EChartsOption } from 'echarts';
import type {
  DashboardData,
  MetricItem,
  TrendPoint,
  DepartmentTaskItem,
  RiskAlertItem,
  KeyWorkItem,
  AiUsageItem,
  CollaborationItem,
  WorkloadItem,
  BusinessMetricItem,
  OrgRunningItem,
} from '@/server/modules/cockpit/cockpit-service';

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

const STATUS_LABEL: Record<string, string> = {
  open: '待处置',
  resolved: '已闭环',
  in_progress: '处置中',
};

const PRIORITY_LABEL: Record<string, string> = {
  P0: '紧急',
  P1: '高',
  P2: '中',
  P3: '低',
};

function buildTaskTrendOption(data: TrendPoint[]): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.period),
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
        data: data.map((d) => d.value),
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

function buildDepartmentOption(data: DepartmentTaskItem[]): EChartsOption {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#8a97a8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#eef2f6' } },
    },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.department),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#475569', fontSize: 11 },
    },
    series: [
      {
        name: '已完成',
        type: 'bar',
        stack: 'total',
        data: data.map((d) => d.completed),
        itemStyle: { color: '#1e7b4f' },
        barWidth: 14,
      },
      {
        name: '进行中',
        type: 'bar',
        stack: 'total',
        data: data.map((d) => d.total - d.completed - d.overdue),
        itemStyle: { color: '#cc0000' },
        barWidth: 14,
      },
      {
        name: '延期',
        type: 'bar',
        stack: 'total',
        data: data.map((d) => d.overdue),
        itemStyle: { color: '#b42318' },
        barWidth: 14,
      },
    ],
    legend: {
      data: ['已完成', '进行中', '延期'],
      bottom: 0,
      textStyle: { color: '#8a97a8', fontSize: 11 },
    },
  };
}

function buildBusinessTrendOption(data: TrendPoint[]): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.period),
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
        type: 'bar',
        data: data.map((d) => d.value),
        itemStyle: { color: '#cc0000', borderRadius: [2, 2, 0, 0] },
        barWidth: 20,
      },
    ],
  };
}

function buildAiUsageOption(data: AiUsageItem[]): EChartsOption {
  return {
    tooltip: { trigger: 'item' },
    legend: {
      bottom: 0,
      textStyle: { color: '#8a97a8', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        data: data.map((d) => ({ name: d.agentName, value: d.runCount })),
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { color: '#475569', fontSize: 11 },
      },
    ],
    color: ['#cc0000', '#e02b2b', '#55677a', '#b08a4a', '#1e7b4f'],
  };
}

type DashboardViewProps = {
  data: DashboardData;
};

export function DashboardView({ data }: DashboardViewProps) {
  const topMetrics = data.metrics.slice(0, 6);
  const metricVariant = (code: string): 'default' | 'ok' | 'warn' | 'danger' => {
    if (code === 'task_completion_rate') return 'ok';
    if (code === 'task_overdue_rate') return 'warn';
    if (code === 'risk_alert_count') return 'danger';
    return 'default';
  };

  return (
    <div className="flex flex-col gap-4">
      {data.isMock && (
        <div
          className="bz-badge bz-badge-gold"
          style={{ alignSelf: 'flex-start', fontSize: 12 }}
        >
          当前数据包含模拟数据，仅供参考
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[var(--bz-text-sub)]">
          数据范围：<strong className="text-[var(--bz-brand)]">{data.scopeLabel}</strong>
        </span>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {topMetrics.map((m: MetricItem) => (
          <MetricTile
            key={m.code}
            label={m.name}
            value={m.value}
            unit={m.unit}
            trend={m.trend}
            trendLabel={m.trendLabel}
            isMock={m.isMock}
            variant={metricVariant(m.code)}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">任务趋势</span>
            {data.isMock && <span className="bz-badge bz-badge-gold" style={{ fontSize: 10 }}>模拟数据</span>}
          </div>
          <div className="p-3">
            <Chart option={buildTaskTrendOption(data.taskTrend)} height={240} />
          </div>
        </div>

        <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">部门任务分布</span>
            {data.isMock && <span className="bz-badge bz-badge-gold" style={{ fontSize: 10 }}>模拟数据</span>}
          </div>
          <div className="p-3">
            {data.departmentTasks.length > 0 ? (
              <Chart option={buildDepartmentOption(data.departmentTasks)} height={240} />
            ) : (
              <div className="flex items-center justify-center h-[240px] text-[var(--bz-text-muted)] text-[13px]">
                个人视角下无部门分布数据
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">经营趋势</span>
            {data.isMock && <span className="bz-badge bz-badge-gold" style={{ fontSize: 10 }}>模拟数据</span>}
          </div>
          <div className="p-3">
            {data.businessTrend.length > 0 ? (
              <Chart option={buildBusinessTrendOption(data.businessTrend)} height={220} />
            ) : (
              <div className="flex items-center justify-center h-[220px] text-[var(--bz-text-muted)] text-[13px]">
                个人视角下无经营趋势数据
              </div>
            )}
          </div>
        </div>

        <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">AI调用分布</span>
            {data.isMock && <span className="bz-badge bz-badge-gold" style={{ fontSize: 10 }}>模拟数据</span>}
          </div>
          <div className="p-3">
            <Chart option={buildAiUsageOption(data.aiUsage)} height={220} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">风险预警</span>
            <span className="text-[12px] text-[var(--bz-text-muted)]">{data.riskAlerts.length} 条</span>
          </div>
          <div className="bz-scroll" style={{ maxHeight: 280 }}>
            <table className="bz-table">
              <thead>
                <tr>
                  <th>预警标题</th>
                  <th>级别</th>
                  <th>状态</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {data.riskAlerts.map((alert: RiskAlertItem) => (
                  <tr key={alert.id}>
                    <td className="font-medium">{alert.title}</td>
                    <td>
                      <span className={`bz-badge ${SEVERITY_VARIANT[alert.severity] ?? 'bz-badge-gray'}`}>
                        {SEVERITY_LABEL[alert.severity] ?? alert.severity}
                      </span>
                    </td>
                    <td>
                      <span className="bz-badge bz-badge-gray">
                        {STATUS_LABEL[alert.status] ?? alert.status}
                      </span>
                    </td>
                    <td className="text-[var(--bz-text-muted)]">
                      {new Date(alert.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">重点工作</span>
            {data.isMock && <span className="bz-badge bz-badge-gold" style={{ fontSize: 10 }}>模拟数据</span>}
          </div>
          <div className="bz-scroll" style={{ maxHeight: 280 }}>
            <table className="bz-table">
              <thead>
                <tr>
                  <th>工作名称</th>
                  <th>优先级</th>
                  <th>负责人</th>
                  <th>进度</th>
                </tr>
              </thead>
              <tbody>
                {data.keyWorks.map((work: KeyWorkItem) => (
                  <tr key={work.id}>
                    <td className="font-medium">{work.title}</td>
                    <td>
                      <span className="bz-badge bz-badge-blue">
                        {PRIORITY_LABEL[work.priority] ?? work.priority}
                      </span>
                    </td>
                    <td>{work.owner}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--bz-line)', maxWidth: 60 }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${work.progress}%`,
                              background: work.progress === 100 ? 'var(--bz-ok)' : 'var(--bz-brand)',
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-[var(--bz-text-muted)]">{work.progress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {data.scope !== 'self' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">协同事项</span>
                {data.isMock && <span className="bz-badge bz-badge-gold" style={{ fontSize: 10 }}>模拟数据</span>}
              </div>
              <div className="bz-scroll" style={{ maxHeight: 200 }}>
                <table className="bz-table">
                  <thead>
                    <tr>
                      <th>协同名称</th>
                      <th>类型</th>
                      <th>状态</th>
                      <th>成员数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.collaborations.map((collab: CollaborationItem) => (
                      <tr key={collab.id}>
                        <td className="font-medium">{collab.title}</td>
                        <td>{collab.type}</td>
                        <td>
                          <span className="bz-badge bz-badge-ok">{collab.status}</span>
                        </td>
                        <td>{collab.memberCount}人</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">工作量分析</span>
                {data.isMock && <span className="bz-badge bz-badge-gold" style={{ fontSize: 10 }}>模拟数据</span>}
              </div>
              <div className="bz-scroll" style={{ maxHeight: 200 }}>
                <table className="bz-table">
                  <thead>
                    <tr>
                      <th>人员</th>
                      <th>总任务</th>
                      <th>进行中</th>
                      <th>已完成</th>
                      <th>延期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workloads.map((wl: WorkloadItem) => (
                      <tr key={wl.userId}>
                        <td className="font-medium">{wl.userName}</td>
                        <td>{wl.totalTasks}</td>
                        <td>{wl.inProgressTasks}</td>
                        <td>{wl.completedTasks}</td>
                        <td>
                          {wl.overdueTasks > 0 ? (
                            <span className="bz-badge bz-badge-danger">{wl.overdueTasks}</span>
                          ) : (
                            <span className="text-[var(--bz-text-muted)]">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">业务指标</span>
                {data.isMock && <span className="bz-badge bz-badge-gold" style={{ fontSize: 10 }}>模拟数据</span>}
              </div>
              <div className="bz-scroll" style={{ maxHeight: 200 }}>
                <table className="bz-table">
                  <thead>
                    <tr>
                      <th>指标名称</th>
                      <th>数值</th>
                      <th>单位</th>
                      <th>周期</th>
                      <th>来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.businessMetrics.map((bm: BusinessMetricItem) => (
                      <tr key={bm.code}>
                        <td className="font-medium">{bm.name}</td>
                        <td className="num">{bm.value.toLocaleString('zh-CN')}</td>
                        <td>{bm.unit}</td>
                        <td>{bm.period}</td>
                        <td>
                          <span className="bz-badge bz-badge-gray">{bm.source}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">组织运行</span>
                {data.isMock && <span className="bz-badge bz-badge-gold" style={{ fontSize: 10 }}>模拟数据</span>}
              </div>
              <div className="bz-scroll" style={{ maxHeight: 200 }}>
                <table className="bz-table">
                  <thead>
                    <tr>
                      <th>组织</th>
                      <th>总人数</th>
                      <th>活跃人数</th>
                      <th>任务完成率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orgRunning.map((org: OrgRunningItem) => (
                      <tr key={org.orgUnitName}>
                        <td className="font-medium">{org.orgUnitName}</td>
                        <td>{org.totalUsers}</td>
                        <td>{org.activeUsers}</td>
                        <td>
                          <span style={{
                            color: org.taskCompletionRate >= 70 ? 'var(--bz-ok)' : 'var(--bz-warn)',
                            fontWeight: 500,
                          }}>
                            {org.taskCompletionRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}