/**
 * 标准数据源 Connector 接口（PRD 第十三章：对无法接入的外部数据源提供标准接口）。
 *
 * 三条硬约束写进类型里，而不是靠文档口头约定：
 *  1. 每条事实必须带原文摘录与采集时间 —— 没有 excerpt 就不允许入库，
 *     否则前端展示的"证据"只是连接器自己编的一句话。
 *  2. `bypassesAccessControls` 恒为 false：连接器不得绕过登录、验证码、付费墙或 robots。
 *  3. 未接入的源必须显式返回状态与原因，不能返回空数组装作"查过了没有"。
 */

export type SourceTier =
  | 'tier1_official'
  | 'tier2_professional_db'
  | 'tier3_media_industry'
  | 'tier4_self_reported';

export type AccessMethod =
  | 'public_open_api'
  | 'licensed_api'
  | 'public_web_page'
  | 'user_upload'
  | 'demo_fixture';

/** 接入状态。界面上要能看出"为什么这个源没有数据"。 */
export type ConnectorStatus =
  | 'available'
  | 'requires_credentials'
  | 'requires_license'
  | 'blocked_by_policy'
  | 'not_integrated';

export type SignalKind =
  | 'enterprise_identity'
  | 'patent'
  | 'rnd'
  | 'talent'
  | 'hiring'
  | 'research'
  | 'investment'
  | 'product'
  | 'customer'
  | 'order'
  | 'tender'
  | 'commercialization'
  | 'ecosystem'
  | 'industry_chain';

/** 数据分级，与 tvd_data_kind 枚举一一对应。 */
export type FactDataKind =
  | 'REAL_DATA'
  | 'DEMO_DATA'
  | 'SYNTHETIC_DATA'
  | 'USER_UPLOADED'
  | 'UNVERIFIED';

export type ConnectorQuery = {
  /** 企业名（连接器内部自行做主体归一）。 */
  enterpriseName: string;
  /** 统一社会信用代码；没有就留 null，不允许连接器去猜一个。 */
  unifiedCode?: string | null;
  region?: string | null;
  /** 只看这个时间之后的信号。 */
  since?: string;
  limit?: number;
};

export type ConnectorFact = {
  signalType: SignalKind;
  subject: string;
  textValue: string | null;
  observedValue: string | null;
  valueUnit: string | null;
  occurredAt: string | null;
  /** 原文摘录，必填。 */
  excerpt: string;
  sourceTitle: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  accessMethod: AccessMethod;
  dataKind: FactDataKind;
  /** 同一根节点转载归并用：转载站填原发布方，独立源计数才不会被转载灌水。 */
  originPublisher: string | null;
};

export type ConnectorResult = {
  connectorId: string;
  status: ConnectorStatus;
  /** 本次是否真的取到了可用数据。status 非 available 时恒为 false。 */
  ok: boolean;
  facts: ConnectorFact[];
  /** 未取到数据时的原因与接入条件，直接展示给用户。 */
  message: string | null;
  /** 合规声明，恒为 false。 */
  bypassesAccessControls: false;
  collectedAt: string;
};

export interface SourceConnector {
  readonly id: string;
  readonly name: string;
  /** 数据归属机构，用户判断可信度要用。 */
  readonly org: string;
  readonly tier: SourceTier;
  readonly accessMethod: AccessMethod;
  readonly signalTypes: readonly SignalKind[];
  readonly integrationStatus: ConnectorStatus;
  /** 接入需要准备的东西：账号、授权、接口申请、文件格式。 */
  readonly requires: readonly string[];
  /** 不采集，只回答"现在能不能采"。 */
  probe(): Promise<{ reachable: boolean; note: string }>;
  collect(query: ConnectorQuery): Promise<ConnectorResult>;
}

export function notIntegratedResult(
  c: Pick<SourceConnector, 'id' | 'integrationStatus'>,
  message: string,
): ConnectorResult {
  return {
    connectorId: c.id,
    status: c.integrationStatus,
    ok: false,
    facts: [],
    message,
    bypassesAccessControls: false,
    collectedAt: new Date().toISOString(),
  };
}
