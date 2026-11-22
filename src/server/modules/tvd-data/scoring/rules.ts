/**
 * TVD-10 五维评分模型 V1 的规则数据。
 *
 * 权重、分档、目录全部以数据形式存在这里，而不是散在 if 里 ——
 * 命题红线是"所有评分必须由确定性代码执行"，可复算的前提是规则本身可读、可版本化、
 * 可以整体替换成 v2 再回归对比。
 *
 * 数值来源：《2.0 增量升级 PRD》第十五章（TVD-10）与 9.2（专利质量 Q1–Q6）。
 * PRD 明确写的是"V1 初始参数，必须允许行业适配、版本管理及后续校准"，
 * 因此这里的常量都是可替换的输入，而不是结论。
 */

import type { Dimension, IndicatorStatus } from './types';

export const RULE_VERSION = 'tvs-v1';
export const MODEL_CODE = 'TVA-TechValue';
export const MODEL_NAME = '科技企业价值发现五维模型';

/** PRD 15.1：T25 / P25 / R20 / C20 / E10。 */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  T: 0.25,
  P: 0.25,
  R: 0.2,
  C: 0.2,
  E: 0.1,
};

export const DIMENSION_NAMES: Record<Dimension, string> = {
  T: '技术先进性',
  P: '知识产权质量',
  R: '研发团队能力',
  C: '商业化进展',
  E: '创新生态与成长潜力',
};

/** PRD 15.2 的分级区间；分低不等于企业没实力，措辞按原文。 */
export const GRADE_BANDS: { atLeast: number; grade: string; label: string }[] = [
  { atLeast: 90, grade: 'S', label: '卓越技术价值信号' },
  { atLeast: 80, grade: 'A', label: '强技术价值信号' },
  { atLeast: 70, grade: 'B', label: '较强技术表现' },
  { atLeast: 60, grade: 'C', label: '中等技术表现' },
  { atLeast: 40, grade: 'D', label: '技术价值证据较弱' },
  { atLeast: 0, grade: 'E', label: '当前证据支持较低' },
];

/** 覆盖率低于此值不出总分，只输出分项与"证据不足"（PRD 15.2 / 15.5）。 */
export const MIN_DATA_COVERAGE = 0.6;
/** 关键结论需要几个独立来源；不足则按 unverifiedWeight 折减而不是直接丢弃。 */
export const MIN_INDEPENDENT_SOURCES = 2;
/** 单源或未核实的指标仍参与计算，但权重折半 —— "未核实信号不能直接成为高权重评分依据"。 */
export const UNVERIFIED_WEIGHT_FACTOR = 0.5;

export type Band = { atLeast: number; score: number; label: string };

export type IndicatorRule = {
  code: string;
  name: string;
  dimension: Dimension;
  /** 维度内权重，同一维度六项合计 1。 */
  weight: number;
  /** 指向 calculators.ts 里唯一的纯函数，禁止自然语言打分。 */
  calculator: string;
  /** 依赖的特征键；任一为 null 即判 UNAVAILABLE，不当 0 分处理。 */
  requiredMetrics: string[];
  /** 分档表；方向统一为"原始值越大越好"，反向口径由 calculator 先转换。 */
  bands: Band[];
  /** 计算口径说明，直接进 UI，避免只给分不给解释。 */
  basis: string;
  params?: Record<string, number>;
};

/** 分档常用写法：从高到低列出"达到多少分算这一档"。 */
const b = (pairs: [number, number, string][]): Band[] =>
  pairs.map(([atLeast, score, label]) => ({ atLeast, score, label }));

/**
 * 关键核心技术赛道目录（V1）。
 *
 * 这是公开政策口径的分类词表，不是对本企业技术的判断：
 * 命中只代表"落在被广泛列为关键核心技术的领域内"，用于 T3 的分档输入。
 */
export const KEY_TECH_TRACKS = [
  '半导体设备',
  '存储主控芯片',
  '频率器件',
  '光模块',
  '激光器件',
  '微波器件',
  '光电分选',
  '微显示',
  '工业机器人',
  '机器人核心部件',
  '机器人集成',
  '科学仪器',
  '分析仪器',
  '质谱仪器',
  '介入器械',
  '植入器械',
  '植入介入',
  '植入式医疗器械',
  '血管介入',
  '介入耗材',
  '骨科植入',
  '数字身份',
  '国产数据库',
  '大数据与治理',
  '轨道交通信号',
  '配电自动化',
  '光纤传感',
  '传感器',
  '锂电装备',
  '膜分离',
  '碳基材料',
  '稀有金属电子材料',
  '纳米粉体',
  '电子化学品',
  '功能薄膜',
  '电子功能膜',
];

/** 战略性新兴产业行业目录（V1），用于 T6 产业适配分档。 */
export const STRATEGIC_INDUSTRIES = [
  '半导体与集成电路',
  '生物医药与医疗器械',
  '新材料',
  '新能源与储能',
  '高端装备制造',
  '航空航天与军工',
  '光学光电子',
  '智能电网',
  '节能环保',
  '软件与信息技术',
];

export const INDICATOR_RULES: IndicatorRule[] = [
  // ---------- T 技术先进性（PRD 10.2） ----------
  {
    code: 'T1',
    name: '技术创新性',
    dimension: 'T',
    weight: 0.25,
    calculator: 'ratio_band',
    requiredMetrics: ['invention_share'],
    bands: b([
      [0.7, 90, '发明专利占比 ≥70%'],
      [0.5, 80, '发明专利占比 50–70%'],
      [0.3, 70, '发明专利占比 30–50%'],
      [0.15, 60, '发明专利占比 15–30%'],
      [0, 45, '发明专利占比 <15%'],
    ]),
    basis: '口径：该企业名下发明专利占全部专利的比例。发明需要经过实质审查，作为独创性信号比总量更可靠；比例低不代表没有创新，只代表本语料内可见的实质审查型产出少。',
  },
  {
    code: 'T2',
    name: '技术差异化',
    dimension: 'T',
    weight: 0.2,
    calculator: 'count_band',
    requiredMetrics: ['distinct_tech_domains'],
    bands: b([
      [6, 88, '覆盖 ≥6 个技术领域'],
      [4, 78, '覆盖 4–5 个技术领域'],
      [3, 68, '覆盖 3 个技术领域'],
      [2, 58, '覆盖 2 个技术领域'],
      [1, 48, '仅 1 个技术领域'],
    ]),
    basis: '口径：专利 tech_domains 去重后的领域数。领域分散通常意味着技术路线不止一条；领域单一不判为差，只说明可见差异化的面窄。',
  },
  {
    code: 'T3',
    name: '技术突破程度',
    dimension: 'T',
    weight: 0.2,
    calculator: 'key_track_band',
    requiredMetrics: ['key_track_hit'],
    bands: b([
      [1, 85, '赛道在关键核心技术目录内'],
      [0, 62, '赛道不在目录内（目录为 V1 词表，可能未覆盖）'],
    ]),
    basis: `口径：企业细分赛道是否命中 KEY_TECH_TRACKS 词表（公开政策分类）。命中只表示"处于被广泛列为关键核心技术的领域"，不表示已实现突破。`,
  },
  {
    code: 'T4',
    name: '技术壁垒及可持续性',
    dimension: 'T',
    weight: 0.15,
    calculator: 'ratio_band',
    requiredMetrics: ['recent_filing_ratio'],
    bands: b([
      [0.4, 90, '近 3 年申请占比 ≥40%'],
      [0.25, 80, '近 3 年申请占比 25–40%'],
      [0.15, 70, '近 3 年申请占比 15–25%'],
      [0.05, 58, '近 3 年申请占比 5–15%'],
      [0, 42, '近 3 年几乎无新申请'],
    ]),
    basis: '口径：近 3 年申请量 / 全部申请量。衡量投入是否还在继续；申请停滞也可能是未公开（发明申请 18 个月公开），因此下限只到 42 分。',
  },
  {
    code: 'T5',
    name: '技术成熟度',
    dimension: 'T',
    weight: 0.1,
    calculator: 'ratio_band',
    requiredMetrics: ['granted_share'],
    bands: b([
      [0.7, 88, '授权占比 ≥70%'],
      [0.5, 78, '授权占比 50–70%'],
      [0.3, 68, '授权占比 30–50%'],
      [0, 55, '授权占比 <30%（可能仍在审查中）'],
    ]),
    basis: '口径：已授权专利 / 全部专利。PRD 9.3 明确"不可将授权状态等同于技术先进性"，所以这项只占 10%，且审中较多时下限给到 55。',
  },
  {
    code: 'T6',
    name: '产业适配及关键技术价值',
    dimension: 'T',
    weight: 0.1,
    calculator: 'industry_fit_band',
    requiredMetrics: ['strategic_industry_hit', 'qualification_count'],
    bands: b([
      [2, 90, '战略性新兴产业 + 有部级资质'],
      [1, 78, '命中其一'],
      [0, 55, '目录内均未命中'],
    ]),
    basis: '口径：行业是否属于 STRATEGIC_INDUSTRIES，以及是否有公开资质名单记录。两者合成一个 0/1/2 档位输入。',
  },

  // ---------- P 知识产权质量（PRD 9.2 Q1–Q6） ----------
  {
    code: 'P1',
    name: '技术属性（Q1）',
    dimension: 'P',
    weight: 0.2,
    calculator: 'patent_quality_attribute',
    requiredMetrics: ['invention_share', 'avg_claim_count'],
    bands: b([
      [80, 90, '发明为主且权利要求书较厚实'],
      [65, 78, '发明占比较高'],
      [50, 68, '类型与权利要求中等'],
      [35, 55, '以实用新型为主'],
      [0, 42, '可见技术含量信号弱'],
    ]),
    basis: '口径：发明专利占比与平均权利要求项数的加权。PRD 9.3 禁止把实用新型一律判为低质量，因此这里给的是信号强度而非质量结论。',
    params: { inventionWeight: 0.7, claimWeight: 0.3, claimFullScore: 15 },
  },
  {
    code: 'P2',
    name: '权利状态（Q2）',
    dimension: 'P',
    weight: 0.15,
    calculator: 'legal_status_band',
    requiredMetrics: ['valid_share'],
    bands: b([
      [0.8, 88, '有效权利占比 ≥80%'],
      [0.6, 78, '有效权利占比 60–80%'],
      [0.4, 66, '有效权利占比 40–60%'],
      [0.2, 52, '有效权利占比 20–40%'],
      [0, 38, '多数已失效或驳回'],
    ]),
    basis: '口径：授权且未失效 / 全部。失效原因（期满、未缴年费、主动放弃）本语料未采集，因此不做贬损性推断。',
  },
  {
    code: 'P3',
    name: '技术布局（Q3）',
    dimension: 'P',
    weight: 0.15,
    calculator: 'portfolio_layout_band',
    requiredMetrics: ['distinct_ipc_count', 'total_patents'],
    bands: b([
      [1, 86, 'IPC 小类数 ≥8 且总量 ≥100'],
      [2, 74, 'IPC 小类数 ≥4'],
      [3, 62, 'IPC 小类数 ≥2'],
      [4, 50, '仅单一 IPC 小类'],
    ]),
    basis: '口径：IPC 小类去重数与组合规模共同决定的布局宽度。阈值写法为"越小越好"的反向档，由 calculator 先归一。',
  },
  {
    code: 'P4',
    name: '技术关联（Q4）',
    dimension: 'P',
    weight: 0.2,
    calculator: 'ratio_band',
    requiredMetrics: ['domain_relevance_ratio'],
    bands: b([
      [0.8, 90, '专利领域与主营技术高度重合'],
      [0.6, 80, '重合 60–80%'],
      [0.4, 70, '重合 40–60%'],
      [0.2, 58, '重合 20–40%'],
      [0, 45, '重合 <20%（可能是采集口径遗漏）'],
    ]),
    basis: '口径：技术领域命中企业 techKeywords 的专利占比。重合低也可能是关键词抽取不足，故下限保留 45 分并写入待核实。',
  },
  {
    code: 'P5',
    name: '专利组合（Q5）',
    dimension: 'P',
    weight: 0.15,
    calculator: 'portfolio_concentration',
    requiredMetrics: ['inventors_per_patent', 'total_patents'],
    bands: b([
      [80, 88, '协作度高且规模成组'],
      [65, 78, '协作度中等'],
      [50, 66, '以单人或小团队申请为主'],
      [0, 52, '组合结构信号弱'],
    ]),
    basis: '口径：平均每件专利发明人数与组合规模。集中度只作为"是否依赖个别发明人"的提示，不判定重复授权或堆砌。',
    params: { coopFullScore: 3.5, scaleFullScore: 120 },
  },
  {
    code: 'P6',
    name: '创新与影响信号（Q6）',
    dimension: 'P',
    weight: 0.15,
    calculator: 'impact_signal_band',
    requiredMetrics: ['avg_cited_by', 'family_ge2_ratio'],
    bands: b([
      [1, 90, '被引与同族均强'],
      [2, 78, '有跨国同族或稳定被引'],
      [3, 66, '信号一般'],
      [4, 54, '未见被引/同族信号'],
    ]),
    basis: '口径：平均被引次数 + 同族规模 ≥2 的占比。PRD 9.3 明确"不可将引用数等同于技术价值"，因此只占 15%。',
    params: { citedFull: 8, familyFull: 0.25 },
  },

  // ---------- R 研发团队能力（PRD 11.2） ----------
  {
    code: 'R1',
    name: '技术核心人员能力',
    dimension: 'R',
    weight: 0.25,
    calculator: 'core_inventor_band',
    requiredMetrics: ['top_inventor_patents'],
    bands: b([
      [15, 86, '核心发明人产出 ≥15 件'],
      [8, 76, '核心发明人产出 8–14 件'],
      [4, 66, '核心发明人产出 4–7 件'],
      [1, 55, '核心发明人产出 ≤3 件'],
    ]),
    basis: '口径：按姓名归并后单个人名下的专利件数。招聘与履历数据未接入，因此这里只能用专利发明人做代理，并明确标注为代理口径。',
  },
  {
    code: 'R2',
    name: '团队技术结构',
    dimension: 'R',
    weight: 0.2,
    calculator: 'requires_team_roster',
    requiredMetrics: ['team_function_mix'],
    bands: b([[1, 70, '有岗位结构数据']]),
    basis: '需要研发岗位/职能结构数据（招聘或企业上传），当前无合法来源 → 记 UNAVAILABLE，不参与归一化、不计 0 分。',
  },
  {
    code: 'R3',
    name: '技术经验及研发积累',
    dimension: 'R',
    weight: 0.2,
    calculator: 'inventor_depth_band',
    requiredMetrics: ['distinct_inventors', 'filing_year_span'],
    bands: b([
      [80, 88, '发明人 ≥40 人且跨 ≥8 年'],
      [65, 78, '发明人 ≥20 人且跨 ≥6 年'],
      [50, 68, '发明人 ≥10 人'],
      [35, 56, '发明人 <10 人'],
      [0, 45, '可见研发人员极少'],
    ]),
    basis: '口径：去重发明人数 × 申请年份跨度。二者都要满足才进高档，避免"一次性堆量"被读成长期积累。',
    params: { inventorFull: 40, spanFull: 8 },
  },
  {
    code: 'R4',
    name: '研发人才持续投入',
    dimension: 'R',
    weight: 0.15,
    calculator: 'ratio_band',
    requiredMetrics: ['recent_inventor_ratio'],
    bands: b([
      [0.5, 86, '近 3 年新增发明人占比 ≥50%'],
      [0.3, 76, '30–50%'],
      [0.15, 66, '15–30%'],
      [0, 52, '近 3 年几乎无新面孔'],
    ]),
    basis: '口径：近 3 年出现、此前 3 年未出现的发明人 / 全部发明人。同名不自动合并，因此数值偏保守。',
  },
  {
    code: 'R5',
    name: '关键团队稳定性',
    dimension: 'R',
    weight: 0.1,
    calculator: 'requires_personnel_change',
    requiredMetrics: ['key_person_change_count'],
    bands: b([[1, 70, '有人员变动记录']]),
    basis: '需要工商变更/公开人事信息，当前连接器为 blocked_by_policy，无合法来源 → UNAVAILABLE。',
  },
  {
    code: 'R6',
    name: '研发组织成长性',
    dimension: 'R',
    weight: 0.1,
    calculator: 'growth_trend_band',
    requiredMetrics: ['inventor_growth_ratio'],
    bands: b([
      [1.3, 88, '近 3 年发明人规模明显扩张'],
      [1.1, 76, '小幅扩张'],
      [0.9, 64, '基本持平'],
      [0, 48, '收缩（也可能是公开滞后）'],
    ]),
    basis: '口径：近 3 年去重发明人数 / 前 3 年去重发明人数。',
  },

  // ---------- C 商业化进展（PRD 12.2） ----------
  {
    code: 'C1',
    name: '产品化程度',
    dimension: 'C',
    weight: 0.2,
    calculator: 'signal_presence_band',
    requiredMetrics: ['product_signal_count'],
    bands: b([
      [3, 85, '多条产品信号'],
      [1, 70, '有产品信号'],
      [0, 40, '未见产品信号'],
    ]),
    basis: '口径：signal_type=product 的信号条数。产品发布 ≠ 商业化成功（PRD 12.1），因此即便命中也只给到 85。',
    params: { signalType: 1 },
  },
  {
    code: 'C2',
    name: '客户及应用验证',
    dimension: 'C',
    weight: 0.2,
    calculator: 'requires_customer_evidence',
    requiredMetrics: ['customer_signal_count'],
    bands: b([[1, 75, '有客户/应用证据']]),
    basis: '客户名单属非公开信息，标准 Connector 未接入 → UNAVAILABLE。',
  },
  {
    code: 'C3',
    name: '订单及合同信号',
    dimension: 'C',
    weight: 0.2,
    calculator: 'requires_tender_evidence',
    requiredMetrics: ['order_signal_count', 'tender_signal_count'],
    bands: b([[1, 78, '有中标/订单公告']]),
    basis: '需要招投标公告源（requires_credentials），当前无 → UNAVAILABLE。',
  },
  {
    code: 'C4',
    name: '技术交付能力',
    dimension: 'C',
    weight: 0.15,
    calculator: 'requires_delivery_evidence',
    requiredMetrics: ['delivery_signal_count'],
    bands: b([[1, 72, '有交付/验收记录']]),
    basis: '交付证据一般来自行内尽调材料（用户上传），本语料未含 → UNAVAILABLE。',
  },
  {
    code: 'C5',
    name: '市场拓展信号',
    dimension: 'C',
    weight: 0.15,
    calculator: 'requires_market_evidence',
    requiredMetrics: ['ecosystem_signal_count'],
    bands: b([[1, 70, '有渠道/合作拓展证据']]),
    basis: '生态合作与产业链源未接入 → UNAVAILABLE。',
  },
  {
    code: 'C6',
    name: '商业持续性',
    dimension: 'C',
    weight: 0.1,
    calculator: 'requires_financial_evidence',
    requiredMetrics: ['revenue_signal_count'],
    bands: b([[1, 75, '有持续收入证据']]),
    basis: '收入数据需企业授权或财报，演示语料不含 → UNAVAILABLE。',
  },

  // ---------- E 创新生态与成长潜力（PRD 15.4） ----------
  {
    code: 'E1',
    name: '科研源头关联',
    dimension: 'E',
    weight: 0.2,
    calculator: 'requires_research_evidence',
    requiredMetrics: ['research_signal_count'],
    bands: b([[1, 76, '有论文/科研项目关联']]),
    basis: '论文与科研项目源未接入 → UNAVAILABLE。',
  },
  {
    code: 'E2',
    name: '资本认可',
    dimension: 'E',
    weight: 0.2,
    calculator: 'requires_investment_evidence',
    requiredMetrics: ['investment_signal_count'],
    bands: b([[1, 78, '有公开融资记录']]),
    basis: '融资数据源未接入 → UNAVAILABLE。',
  },
  {
    code: 'E3',
    name: '产业链位置',
    dimension: 'E',
    weight: 0.2,
    calculator: 'requires_chain_evidence',
    requiredMetrics: ['industry_chain_signal_count'],
    bands: b([[1, 74, '有产业链环节证据']]),
    basis: '产业链图谱源未接入 → UNAVAILABLE。',
  },
  {
    code: 'E4',
    name: '园区与集群',
    dimension: 'E',
    weight: 0.15,
    calculator: 'requires_park_evidence',
    requiredMetrics: ['park_signal_count'],
    bands: b([[1, 70, '有园区/集群名单记录']]),
    basis: '园区名单源未接入 → UNAVAILABLE。',
  },
  {
    code: 'E5',
    name: '成长信号强度',
    dimension: 'E',
    weight: 0.15,
    calculator: 'growth_trend_band',
    requiredMetrics: ['recent_filing_growth_ratio'],
    bands: b([
      [1.5, 90, '近 3 年申请量显著上升'],
      [1.2, 78, '上升'],
      [0.85, 64, '基本持平'],
      [0, 48, '回落'],
    ]),
    basis: '口径：近 3 年申请量 / 前 3 年申请量 —— 语料内唯一可得的成长信号，作为 E5 的代理。',
  },
  {
    code: 'E6',
    name: '创新生态协同',
    dimension: 'E',
    weight: 0.1,
    calculator: 'requires_collab_evidence',
    requiredMetrics: ['collab_patent_ratio'],
    bands: b([[1, 72, '有联合申请记录']]),
    basis: '联合申请需申请人字段比对；本语料 applicantNormalized 全部为单主体 → 记 NOT_APPLICABLE，不折算加分。',
  },
];

/** 可评分状态：只有这三种会进入归一化分母。 */
export const SCORABLE_STATUSES: IndicatorStatus[] = ['AVAILABLE', 'PARTIAL', 'UNVERIFIED'];

export function indicatorsOf(dimension: Dimension): IndicatorRule[] {
  return INDICATOR_RULES.filter((r) => r.dimension === dimension);
}

/** 权重自检：维度内合计、五维合计。规则改动后由测试脚本挡住手改坏的表。 */
export function validateRules(): string[] {
  const problems: string[] = [];
  for (const dim of Object.keys(DIMENSION_WEIGHTS) as Dimension[]) {
    const sum = indicatorsOf(dim).reduce((n, r) => n + r.weight, 0);
    if (Math.abs(sum - 1) > 1e-9) problems.push(`${dim} 维度内权重合计 ${sum.toFixed(4)} ≠ 1`);
    if (indicatorsOf(dim).length !== 6) problems.push(`${dim} 维度指标数为 ${indicatorsOf(dim).length}，PRD 要求 6 项`);
  }
  const dimSum = Object.values(DIMENSION_WEIGHTS).reduce((n, v) => n + v, 0);
  if (Math.abs(dimSum - 1) > 1e-9) problems.push(`五维权重合计 ${dimSum.toFixed(4)} ≠ 1`);
  return problems;
}
