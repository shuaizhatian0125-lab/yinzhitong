/**
 * TVD 枚举的中文标签与徽章样式。
 *
 * 集中放这里是因为同一批枚举在列表页、详情页、数据源面板都要出现：
 * 各写一份的结果是某处漏了一个值，页面上就直接显示 `tier1_official` 这种内部码。
 * 键与 src/storage/database/tvd/core.ts 的枚举取值保持一致。
 */

export const DATA_KIND_LABEL: Record<string, { label: string; cls: string }> = {
  REAL_DATA: { label: '真实采集', cls: 'bz-badge-ok' },
  DEMO_DATA: { label: '演示数据', cls: 'bz-badge-gold' },
  SYNTHETIC_DATA: { label: '合成演示', cls: 'bz-badge-warn' },
  USER_UPLOADED: { label: '用户上传', cls: 'bz-badge-blue' },
  AI_INFERENCE: { label: 'AI 推断', cls: 'bz-badge-blue' },
  UNVERIFIED: { label: '未核实', cls: 'bz-badge-gray' },
};

export const VERIFICATION_LABEL: Record<string, { label: string; cls: string }> = {
  unverified: { label: '未核实', cls: 'bz-badge-gray' },
  single_source: { label: '单源', cls: 'bz-badge-warn' },
  multi_source: { label: '多源印证', cls: 'bz-badge-blue' },
  verified: { label: '已核实', cls: 'bz-badge-ok' },
  disputed: { label: '存在冲突', cls: 'bz-badge-danger' },
};

export const SIGNAL_TYPE_LABEL: Record<string, string> = {
  enterprise_identity: '企业身份',
  patent: '专利',
  rnd: '研发投入',
  talent: '人才',
  hiring: '招聘',
  research: '科研',
  investment: '投融资',
  product: '产品',
  customer: '客户',
  order: '订单',
  tender: '中标',
  commercialization: '产业化',
  ecosystem: '生态合作',
  industry_chain: '产业链',
};

export const SOURCE_TIER_LABEL: Record<string, string> = {
  tier1_official: '一级 · 官方',
  tier2_professional_db: '二级 · 专业库',
  tier3_media_industry: '三级 · 媒体/行业',
  tier4_self_reported: '四级 · 自述',
};

export const ACCESS_METHOD_LABEL: Record<string, string> = {
  public_open_api: '公开 API',
  licensed_api: '授权接口',
  public_web_page: '公开网页',
  user_upload: '用户上传',
  demo_fixture: '演示样本',
};

export const CONNECTOR_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  available: { label: '已接入', cls: 'bz-badge-ok' },
  requires_credentials: { label: '需开通凭证', cls: 'bz-badge-warn' },
  requires_license: { label: '需商业授权', cls: 'bz-badge-warn' },
  blocked_by_policy: { label: '合规限制', cls: 'bz-badge-danger' },
  not_integrated: { label: '未接入', cls: 'bz-badge-gray' },
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

/**
 * TVD-06 专利异常类型。
 * 措辞统一为"需核实"：异常只是提示要去查，不是对企业下造假的结论（PRD 硬约束）。
 */
export const ANOMALY_TYPE_LABEL: Record<string, string> = {
  filing_surge: '集中申请待核实',
  near_duplicate: '名称重复待核实',
  repeated_topic: '主题集中待核实',
  assignee_irregularity: '权利归属待核实',
  legal_status_irregularity: '法律状态待核实',
  inventor_concentration: '发明人集中待核实',
  agency_concentration: '代理集中提示',
  tech_mismatch: '主营关联待核实',
};

export const ANOMALY_SEVERITY_LABEL: Record<string, { label: string; cls: string }> = {
  high: { label: '优先核实', cls: 'bz-badge-danger' },
  warning: { label: '需核实', cls: 'bz-badge-warn' },
  info: { label: '仅提示', cls: 'bz-badge-gray' },
};

export const PATENT_TYPE_LABEL: Record<string, string> = {
  invention: '发明',
  utility_model: '实用新型',
  design: '外观',
};

export const PATENT_LEGAL_STATUS_LABEL: Record<string, string> = {
  pending: '审中',
  granted: '授权',
  rejected: '驳回',
  expired: '失效（期满）',
  abandoned: '放弃',
  lapsed: '失效（未缴年费）',
  unknown: '未知',
};

/**
 * PRD 15.5 的指标数据状态。
 * "无法获取"与"未取得"必须分开显示：前者是数据源没接，后者是接了但没有，
 * 两者都不得当成 0 分，页面上也不能合并成一个词。
 */
export const INDICATOR_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: '已评分', cls: 'bz-badge-ok' },
  PARTIAL: { label: '部分证据', cls: 'bz-badge-warn' },
  UNAVAILABLE: { label: '无法获取', cls: 'bz-badge-gray' },
  NOT_APPLICABLE: { label: '不适用', cls: 'bz-badge-gray' },
  CONFLICTED: { label: '证据冲突', cls: 'bz-badge-danger' },
  UNVERIFIED: { label: '未核实（权重折减）', cls: 'bz-badge-warn' },
};

export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—';
  return map[key] ?? key;
}

export function badgeOf(
  map: Record<string, { label: string; cls: string }>,
  key: string | null | undefined,
): { label: string; cls: string } {
  if (!key) return { label: '—', cls: 'bz-badge-gray' };
  return map[key] ?? { label: key, cls: 'bz-badge-gray' };
}
