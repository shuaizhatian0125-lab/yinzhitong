import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type DataSourceType = 'actual' | 'mock' | 'user_input' | 'external_public' | 'ai_inferred';

export type MetricQueryResult = {
  metricCode: string;
  metricName: string;
  value: number;
  unit: string;
  period: string;
  dataSource: DataSourceType;
  dataSourceLabel: string;
  dimensions: Record<string, string>;
  trend: TrendPoint[];
};

export type TrendPoint = {
  period: string;
  value: number;
};

export type MultiDimensionResult = {
  dimension: string;
  items: DimensionItem[];
  dataSource: DataSourceType;
  dataSourceLabel: string;
};

export type DimensionItem = {
  dimensionValue: string;
  metrics: Record<string, number>;
};

export type AnomalyAttributionResult = {
  metricCode: string;
  metricName: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  deviationRate: number;
  severity: 'low' | 'medium' | 'high';
  factors: AttributionFactor[];
  dataSource: DataSourceType;
  dataSourceLabel: string;
};

export type AttributionFactor = {
  factorName: string;
  contribution: number;
  contributionRate: number;
  description: string;
  dataSource: DataSourceType;
};

const DATA_SOURCE_LABELS: Record<DataSourceType, string> = {
  actual: '实际数据',
  mock: '模拟数据',
  user_input: '用户输入',
  external_public: '外部公开',
  ai_inferred: 'AI推断',
};

type MetricFilter = {
  period?: string;
  dimensionValues?: Record<string, string>;
};

const MOCK_METRIC_REGISTRY: Record<string, { name: string; unit: string; domain: string; dataSource: DataSourceType }> = {
  loan_balance: { name: '贷款余额', unit: '万元', domain: '业务', dataSource: 'mock' },
  deposit_balance: { name: '存款余额', unit: '万元', domain: '业务', dataSource: 'mock' },
  npl_ratio: { name: '不良贷款率', unit: '%', domain: '风险', dataSource: 'mock' },
  roa: { name: '资产收益率', unit: '%', domain: '财务', dataSource: 'mock' },
  roe: { name: '净资产收益率', unit: '%', domain: '财务', dataSource: 'mock' },
  cost_income_ratio: { name: '成本收入比', unit: '%', domain: '财务', dataSource: 'mock' },
  customer_count: { name: '客户总数', unit: '户', domain: '客户', dataSource: 'mock' },
  new_customer_count: { name: '新增客户数', unit: '户', domain: '客户', dataSource: 'mock' },
  task_completion_rate: { name: '任务完成率', unit: '%', domain: '运营', dataSource: 'actual' },
  task_overdue_rate: { name: '任务延期率', unit: '%', domain: '运营', dataSource: 'actual' },
  ai_usage_count: { name: 'AI调用次数', unit: '次', domain: '运营', dataSource: 'actual' },
  revenue: { name: '营业收入', unit: '万元', domain: '财务', dataSource: 'mock' },
  net_profit: { name: '净利润', unit: '万元', domain: '财务', dataSource: 'mock' },
  loan_growth_rate: { name: '贷款增长率', unit: '%', domain: '业务', dataSource: 'mock' },
  deposit_growth_rate: { name: '存款增长率', unit: '%', domain: '业务', dataSource: 'mock' },
};

const MOCK_METRIC_VALUES: Record<string, number> = {
  loan_balance: 5280000,
  deposit_balance: 8650000,
  npl_ratio: 1.32,
  roa: 0.85,
  roe: 12.6,
  cost_income_ratio: 32.5,
  customer_count: 125600,
  new_customer_count: 3200,
  task_completion_rate: 72.5,
  task_overdue_rate: 12.8,
  ai_usage_count: 3420,
  revenue: 185000,
  net_profit: 62000,
  loan_growth_rate: 8.5,
  deposit_growth_rate: 6.2,
};

const MOCK_TRENDS: Record<string, number[]> = {
  loan_balance: [4800000, 4950000, 5100000, 5200000, 5220000, 5250000, 5280000, 5280000],
  deposit_balance: [8200000, 8350000, 8450000, 8550000, 8580000, 8620000, 8650000, 8650000],
  npl_ratio: [1.45, 1.42, 1.38, 1.35, 1.33, 1.32, 1.32, 1.32],
  roa: [0.78, 0.80, 0.82, 0.83, 0.84, 0.85, 0.85, 0.85],
  roe: [11.8, 12.0, 12.2, 12.4, 12.5, 12.6, 12.6, 12.6],
  cost_income_ratio: [35.2, 34.8, 34.2, 33.5, 33.0, 32.8, 32.5, 32.5],
  customer_count: [118000, 120000, 122000, 123500, 124800, 125200, 125600, 125600],
  new_customer_count: [2800, 3000, 3100, 3150, 3200, 3200, 3200, 3200],
  task_completion_rate: [68.5, 69.2, 70.1, 70.8, 71.5, 72.0, 72.5, 72.5],
  task_overdue_rate: [15.2, 14.8, 14.2, 13.8, 13.5, 13.2, 12.8, 12.8],
  ai_usage_count: [1800, 2200, 2600, 2900, 3100, 3300, 3420, 3420],
  revenue: [168000, 172000, 176000, 178000, 180000, 183000, 185000, 185000],
  net_profit: [55000, 57000, 59000, 60000, 61000, 61500, 62000, 62000],
  loan_growth_rate: [6.2, 6.8, 7.2, 7.8, 8.0, 8.3, 8.5, 8.5],
  deposit_growth_rate: [4.5, 5.0, 5.5, 5.8, 6.0, 6.1, 6.2, 6.2],
};

const TREND_PERIODS = ['2025Q1', '2025Q2', '2025Q3', '2025Q4', '2026Q1', '2026Q2', '2026Q3', '2026Q4'];

async function fetchRealMetricSnapshot(
  user: SessionUser,
  metricCode: string,
  filter: MetricFilter,
): Promise<{ value: number; period: string; dataSource: DataSourceType } | null> {
  try {
    const db = getSupabaseClient();
    let query = db
      .from('metric_snapshot')
      .select('value,period,captured_at')
      .eq('tenant_id', user.tenantId)
      .eq('metric_code', metricCode)
      .order('captured_at', { ascending: false })
      .limit(1);

    if (filter.period) {
      query = query.eq('period', filter.period);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    const row = data[0] as Record<string, unknown>;
    return {
      value: row.value as number,
      period: row.period as string,
      dataSource: 'actual',
    };
  } catch {
    return null;
  }
}

export async function queryMetrics(
  user: SessionUser,
  metricCode: string,
  filter: MetricFilter = {},
): Promise<MetricQueryResult | null> {
  const registry = MOCK_METRIC_REGISTRY[metricCode];
  if (!registry) return null;

  const realData = await fetchRealMetricSnapshot(user, metricCode, filter);

  let value: number;
  let dataSource: DataSourceType;
  let period: string;

  if (realData) {
    value = realData.value;
    dataSource = 'actual';
    period = realData.period;
  } else {
    value = MOCK_METRIC_VALUES[metricCode] ?? 0;
    dataSource = registry.dataSource;
    period = filter.period ?? '2026Q4';
  }

  const trendValues = MOCK_TRENDS[metricCode] ?? [];
  const trend: TrendPoint[] = TREND_PERIODS.map((p, i) => ({
    period: p,
    value: trendValues[i] ?? value,
  }));

  return {
    metricCode,
    metricName: registry.name,
    value,
    unit: registry.unit,
    period,
    dataSource,
    dataSourceLabel: DATA_SOURCE_LABELS[dataSource],
    dimensions: filter.dimensionValues ?? {},
    trend,
  };
}

export async function multiDimensionAnalysis(
  user: SessionUser,
  dimension: string,
  metricCodes: string[],
): Promise<MultiDimensionResult> {
  const dimensionValues = getDimensionValues(dimension);
  const items: DimensionItem[] = [];

  for (const dimValue of dimensionValues) {
    const metrics: Record<string, number> = {};
    for (const code of metricCodes) {
      const result = await queryMetrics(user, code, {
        dimensionValues: { [dimension]: dimValue },
      });
      if (result) {
        metrics[code] = applyDimensionVariance(result.value, dimension, dimValue);
      }
    }
    items.push({ dimensionValue: dimValue, metrics });
  }

  return {
    dimension,
    items,
    dataSource: 'mock',
    dataSourceLabel: DATA_SOURCE_LABELS['mock'],
  };
}

function getDimensionValues(dimension: string): string[] {
  const dimensionMap: Record<string, string[]> = {
    department: ['公司金融部', '零售金融部', '风险管理部', '运营管理部', '信息科技部'],
    region: ['华东', '华南', '华北', '西南', '西北', '东北'],
    customer_type: ['大型企业', '中型企业', '小型企业', '个人客户'],
    product_type: ['贷款', '存款', '理财', '信用卡', '中间业务'],
    quarter: ['2025Q1', '2025Q2', '2025Q3', '2025Q4', '2026Q1', '2026Q2', '2026Q3', '2026Q4'],
  };
  return dimensionMap[dimension] ?? [];
}

function applyDimensionVariance(baseValue: number, dimension: string, dimensionValue: string): number {
  const varianceMap: Record<string, Record<string, number>> = {
    department: {
      '公司金融部': 0.35,
      '零售金融部': 0.28,
      '风险管理部': 0.15,
      '运营管理部': 0.12,
      '信息科技部': 0.10,
    },
    region: {
      '华东': 0.30,
      '华南': 0.22,
      '华北': 0.25,
      '西南': 0.10,
      '西北': 0.08,
      '东北': 0.05,
    },
    customer_type: {
      '大型企业': 0.45,
      '中型企业': 0.30,
      '小型企业': 0.15,
      '个人客户': 0.10,
    },
    product_type: {
      '贷款': 0.40,
      '存款': 0.35,
      '理财': 0.10,
      '信用卡': 0.08,
      '中间业务': 0.07,
    },
  };

  const variance = varianceMap[dimension]?.[dimensionValue] ?? 0.1;
  return Math.round(baseValue * variance * 100) / 100;
}

export async function anomalyAttribution(
  user: SessionUser,
  metricCode: string,
): Promise<AnomalyAttributionResult | null> {
  const registry = MOCK_METRIC_REGISTRY[metricCode];
  if (!registry) return null;

  const queryResult = await queryMetrics(user, metricCode);
  if (!queryResult) return null;

  const currentValue = queryResult.value;
  const expectedValue = getExpectedValue(metricCode);
  const deviation = Math.round((currentValue - expectedValue) * 100) / 100;
  const deviationRate = expectedValue !== 0 ? Math.round((deviation / expectedValue) * 1000) / 10 : 0;

  let severity: 'low' | 'medium' | 'high' = 'low';
  const absDeviationRate = Math.abs(deviationRate);
  if (absDeviationRate >= 20) {
    severity = 'high';
  } else if (absDeviationRate >= 10) {
    severity = 'medium';
  }

  const factors = getAttributionFactors(metricCode, deviation);

  return {
    metricCode,
    metricName: registry.name,
    currentValue,
    expectedValue,
    deviation,
    deviationRate,
    severity,
    factors,
    dataSource: 'ai_inferred',
    dataSourceLabel: DATA_SOURCE_LABELS['ai_inferred'],
  };
}

function getExpectedValue(metricCode: string): number {
  const expectedMap: Record<string, number> = {
    loan_balance: 5200000,
    deposit_balance: 8500000,
    npl_ratio: 1.50,
    roa: 0.80,
    roe: 12.0,
    cost_income_ratio: 34.0,
    customer_count: 124000,
    new_customer_count: 3000,
    task_completion_rate: 70.0,
    task_overdue_rate: 14.0,
    ai_usage_count: 3000,
    revenue: 180000,
    net_profit: 60000,
    loan_growth_rate: 7.5,
    deposit_growth_rate: 5.5,
  };
  return expectedMap[metricCode] ?? MOCK_METRIC_VALUES[metricCode] ?? 0;
}

function getAttributionFactors(metricCode: string, deviation: number): AttributionFactor[] {
  const factorMap: Record<string, AttributionFactor[]> = {
    loan_balance: [
      { factorName: '信贷投放节奏加快', contribution: Math.round(deviation * 0.45 * 100) / 100, contributionRate: 45, description: '四季度信贷投放力度加大，新增贷款投放超预期', dataSource: 'ai_inferred' },
      { factorName: '企业融资需求上升', contribution: Math.round(deviation * 0.30 * 100) / 100, contributionRate: 30, description: '区域企业融资需求回暖，带动贷款余额增长', dataSource: 'external_public' },
      { factorName: '产品创新吸引新客户', contribution: Math.round(deviation * 0.15 * 100) / 100, contributionRate: 15, description: '新产品上线吸引增量客户', dataSource: 'ai_inferred' },
      { factorName: '其他因素', contribution: Math.round(deviation * 0.10 * 100) / 100, contributionRate: 10, description: '季节性因素及统计口径调整', dataSource: 'ai_inferred' },
    ],
    npl_ratio: [
      { factorName: '风险管控措施见效', contribution: Math.round(deviation * 0.50 * 100) / 100, contributionRate: 50, description: '不良贷款处置力度加大，核销和转让规模提升', dataSource: 'ai_inferred' },
      { factorName: '信贷结构调整', contribution: Math.round(deviation * 0.25 * 100) / 100, contributionRate: 25, description: '优化信贷结构，减少高风险领域投放', dataSource: 'ai_inferred' },
      { factorName: '经济环境改善', contribution: Math.round(deviation * 0.15 * 100) / 100, contributionRate: 15, description: '区域经济回暖，企业经营改善', dataSource: 'external_public' },
      { factorName: '其他因素', contribution: Math.round(deviation * 0.10 * 100) / 100, contributionRate: 10, description: '统计口径调整及季节性因素', dataSource: 'ai_inferred' },
    ],
    task_completion_rate: [
      { factorName: 'AI辅助提升效率', contribution: Math.round(deviation * 0.40 * 100) / 100, contributionRate: 40, description: 'AI工具使用率提升，任务处理效率提高', dataSource: 'actual' },
      { factorName: '流程优化减少阻塞', contribution: Math.round(deviation * 0.30 * 100) / 100, contributionRate: 30, description: '审批流程优化，任务流转更顺畅', dataSource: 'ai_inferred' },
      { factorName: '人员配置合理化', contribution: Math.round(deviation * 0.20 * 100) / 100, contributionRate: 20, description: '任务分配更均衡，减少瓶颈', dataSource: 'ai_inferred' },
      { factorName: '其他因素', contribution: Math.round(deviation * 0.10 * 100) / 100, contributionRate: 10, description: '其他运营因素', dataSource: 'ai_inferred' },
    ],
  };

  if (factorMap[metricCode]) {
    return factorMap[metricCode];
  }

  return [
    { factorName: '主要驱动因素', contribution: Math.round(deviation * 0.50 * 100) / 100, contributionRate: 50, description: '该指标变动的主要驱动原因', dataSource: 'ai_inferred' },
    { factorName: '次要驱动因素', contribution: Math.round(deviation * 0.25 * 100) / 100, contributionRate: 25, description: '该指标变动的次要驱动原因', dataSource: 'ai_inferred' },
    { factorName: '外部环境影响', contribution: Math.round(deviation * 0.15 * 100) / 100, contributionRate: 15, description: '外部环境变化对该指标的影响', dataSource: 'external_public' },
    { factorName: '其他因素', contribution: Math.round(deviation * 0.10 * 100) / 100, contributionRate: 10, description: '其他不确定因素', dataSource: 'ai_inferred' },
  ];
}

export function getAvailableMetrics(): { code: string; name: string; domain: string; unit: string }[] {
  return Object.entries(MOCK_METRIC_REGISTRY).map(([code, info]) => ({
    code,
    name: info.name,
    domain: info.domain,
    unit: info.unit,
  }));
}

export function getAvailableDimensions(): { code: string; name: string }[] {
  return [
    { code: 'department', name: '部门维度' },
    { code: 'region', name: '区域维度' },
    { code: 'customer_type', name: '客户类型维度' },
    { code: 'product_type', name: '产品类型维度' },
    { code: 'quarter', name: '季度维度' },
  ];
}