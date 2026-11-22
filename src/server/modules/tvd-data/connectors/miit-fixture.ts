import { DEMO_ENTERPRISE_SOURCES, DEMO_ENTERPRISES, type DemoEnterpriseSeed } from '../demo/enterprises';
import type { ConnectorFact, ConnectorQuery, SourceConnector } from './types';

/**
 * 离线名单连接器。
 *
 * 语料来自公开名单的一次人工核对抄录（见 demo/enterprises.ts 的来源说明），
 * 所以 accessMethod 记 demo_fixture、dataKind 记 REAL_DATA：
 * 内容是官方公示的，但本系统没有实时抓取，不能伪装成"在线采集"。
 */

const SRC = DEMO_ENTERPRISE_SOURCES[0];

function toFacts(e: DemoEnterpriseSeed): ConnectorFact[] {
  const shared = {
    sourceTitle: SRC.name,
    sourceUrl: SRC.retrievalUrl,
    publishedAt: '2019-06-13',
    retrievedAt: SRC.retrievedAt,
    accessMethod: 'demo_fixture' as const,
    dataKind: 'REAL_DATA' as const,
    originPublisher: '工业和信息化部',
  };
  return [
    {
      ...shared,
      signalType: 'enterprise_identity',
      subject: '专精特新小巨人认定',
      textValue: e.name,
      observedValue: null,
      valueUnit: null,
      occurredAt: '2019-06-13',
      excerpt: `${e.name}|${e.product}|${e.region}`,
    },
    {
      ...shared,
      signalType: 'product',
      subject: '主导产品',
      textValue: e.product,
      observedValue: null,
      valueUnit: null,
      occurredAt: '2019-06-13',
      excerpt: `${e.name}|${e.product}|${e.region}`,
    },
  ];
}

export const miitLittleGiantFixture: SourceConnector = {
  id: 'miit_little_giant_fixture',
  name: '专精特新"小巨人"名单（随包离线样本）',
  org: '工业和信息化部',
  tier: 'tier1_official',
  accessMethod: 'demo_fixture',
  signalTypes: ['enterprise_identity', 'product'],
  integrationStatus: 'available',
  requires: ['无需账号；名单样本随演示语料一同发布'],

  async probe() {
    return {
      reachable: true,
      note: `样本收录 ${DEMO_ENTERPRISES.length} 家（第一批 248 家中可核对的部分），抄录日期 ${SRC.retrievedAt}`,
    };
  },

  async collect(query: ConnectorQuery) {
    const limit = query.limit ?? 5;
    const hit = DEMO_ENTERPRISES.filter(
      (e) => e.name === query.enterpriseName || e.name.includes(query.enterpriseName),
    ).slice(0, limit);

    return {
      connectorId: miitLittleGiantFixture.id,
      status: 'available' as const,
      ok: hit.length > 0,
      facts: hit.flatMap(toFacts),
      message:
        hit.length > 0
          ? null
          : `离线样本里没有「${query.enterpriseName}」—— 样本只覆盖第一批名单的一部分，未命中不代表企业不存在。`,
      bypassesAccessControls: false as const,
      collectedAt: new Date().toISOString(),
    };
  },
};
