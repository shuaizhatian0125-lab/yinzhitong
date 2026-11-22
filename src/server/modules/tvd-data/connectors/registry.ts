import { notIntegratedResult, type SourceConnector } from './types';
import { miitLittleGiantFixture } from './miit-fixture';

/**
 * 数据源目录。
 *
 * 每个源都实现同一个 SourceConnector 接口，未接入的也照样注册 ——
 * 这样"哪些维度是真实采集、哪些是演示值"是系统里的结构化事实，
 * 而不是靠页面文案解释。PRD 要求：无法真实获取的数据不得伪装成真实采集数据。
 */

function stubConnector(c: Omit<SourceConnector, 'probe' | 'collect'> & { reason: string }): SourceConnector {
  const { reason, ...meta } = c;
  return {
    ...meta,
    async probe() {
      return { reachable: false, note: reason };
    },
    async collect() {
      return notIntegratedResult(meta, reason);
    },
  };
}

export const tvdConnectors: SourceConnector[] = [
  miitLittleGiantFixture,

  stubConnector({
    id: 'cnipa_patent_search',
    name: '国家知识产权局 专利检索与法律状态',
    org: '国家知识产权局',
    tier: 'tier1_official',
    accessMethod: 'licensed_api',
    signalTypes: ['patent', 'commercialization'],
    integrationStatus: 'requires_license',
    requires: ['专利数据服务商业授权（批量检索接口 + 法律状态字段）', '授权后的 appKey/appSecret'],
    reason:
      '未获批量检索授权，且公开检索页有反爬与单次查询限制，不做绕过。当前专利明细为合成演示值，' +
      '接入后只需实现本接口即可替换，页面与评分逻辑不用改。',
  }),

  stubConnector({
    id: 'saic_credit_publicity',
    name: '国家企业信用信息公示系统',
    org: '国家市场监督管理总局',
    tier: 'tier1_official',
    accessMethod: 'public_web_page',
    signalTypes: ['enterprise_identity'],
    integrationStatus: 'blocked_by_policy',
    requires: ['无法自动化：查询需图形验证码，且服务条款禁止批量抓取'],
    reason:
      '需要人工在页面查询后以用户上传方式录入（USER_UPLOADED）。演示语料的统一社会信用代码一律留空，' +
      '正是因为这个源没有可合规自动化的通道，宁缺不造。',
  }),

  stubConnector({
    id: 'listed_annual_report',
    name: '上市公司年报 / 招股书（研发投入、营收、客户集中度）',
    org: '沪深交易所信息披露平台',
    tier: 'tier1_official',
    accessMethod: 'public_web_page',
    signalTypes: ['rnd', 'customer', 'order', 'investment'],
    integrationStatus: 'not_integrated',
    requires: ['PDF 解析通道（已有 pdf-parse 依赖）', '按企业名到证券代码的映射表'],
    reason:
      '披露文件本身是公开可得的，但"下载—解析—抽取到指标"这条链路还没接，' +
      '因此研发费用率、客户集中度等维度显示为未采集，不参与评分而不是按 0 计。',
  }),

  stubConnector({
    id: 'recruitment_postings',
    name: '主流招聘平台在招岗位',
    org: '招聘平台（多家）',
    tier: 'tier3_media_industry',
    accessMethod: 'licensed_api',
    signalTypes: ['hiring', 'talent'],
    integrationStatus: 'blocked_by_policy',
    requires: ['平台开放接口合作协议'],
    reason:
      '各平台 robots 与服务条款均禁止未授权抓取岗位数据，不做绕过。' +
      '没有合作协议时，招聘活跃度维度保持空缺。',
  }),

  stubConnector({
    id: 'government_tender',
    name: '政府采购与招投标公告',
    org: '各级公共资源交易平台',
    tier: 'tier1_official',
    accessMethod: 'public_open_api',
    signalTypes: ['tender', 'order', 'customer'],
    integrationStatus: 'requires_credentials',
    requires: ['平台账号与查询接口开通', '按企业名称/统一社会信用代码的订阅配置'],
    reason: '接口需注册主体后开通。当前未配置凭证，中标与订单信号无来源，不生成推断值。',
  }),

  stubConnector({
    id: 'industry_media',
    name: '行业媒体与舆情',
    org: '行业媒体（多家）',
    tier: 'tier3_media_industry',
    accessMethod: 'public_web_page',
    signalTypes: ['product', 'ecosystem', 'industry_chain'],
    integrationStatus: 'not_integrated',
    requires: ['抓取白名单与去重/归并转载规则（按 origin_record_id 记独立性）'],
    reason:
      '舆情源接入前，画像的生态与产业链层留空。接入后每条结论必须带 excerpt，' +
      '否则不允许写入 tvd_evidence。',
  }),

  stubConnector({
    id: 'user_upload',
    name: '用户上传材料（尽调报告、合同、发票、资质证书）',
    org: '本行客户经理 / 企业方',
    tier: 'tier4_self_reported',
    accessMethod: 'user_upload',
    signalTypes: ['enterprise_identity', 'order', 'customer', 'rnd'],
    integrationStatus: 'not_integrated',
    requires: ['文件存储通道（TVD-05）', '上传后的人工认定流程'],
    reason:
      '自述材料可信度最低，必须走人工认定才能进入评分；上传通道未接，' +
      '所以演示库里的 dataKind 不会出现 USER_UPLOADED。',
  }),
];

export function findConnector(id: string): SourceConnector | undefined {
  return tvdConnectors.find((c) => c.id === id);
}

/** 给接口/界面用的目录视图，不含采集能力细节。 */
export async function describeConnectors() {
  return Promise.all(
    tvdConnectors.map(async (c) => {
      const p = await c.probe();
      return {
        id: c.id,
        name: c.name,
        org: c.org,
        tier: c.tier,
        access_method: c.accessMethod,
        status: c.integrationStatus,
        signal_types: c.signalTypes,
        requires: c.requires,
        reachable: p.reachable,
        note: p.note,
      };
    }),
  );
}

export { notIntegratedResult };
export type { ConnectorFact, ConnectorQuery, ConnectorResult, SourceConnector } from './types';
