import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { getTvdDb, type TvdDb } from '@/storage/database/tvd/client';
import {
  tvdDataSources,
  tvdEnterpriseAliases,
  tvdEnterpriseProfiles,
  tvdEnterprises,
  tvdEvidence,
  tvdEvidenceLinks,
  tvdPatentInventors,
  tvdPatents,
  tvdPatentStats,
  tvdPeople,
  tvdSignalSources,
  tvdSignals,
  tvdSourceRecords,
  tvdTracks,
} from '@/storage/database/tvd';
import { DEMO_ENTERPRISES, DEMO_ENTERPRISE_SOURCES, type DemoEnterpriseSeed } from './demo/enterprises';
import { TVD_DEMO_SCOPE, uuidFrom } from './scope';

/**
 * 演示语料装载。
 *
 * 三条不可让步的规则：
 *  1. 幂等 —— 所有主键由企业名哈希推出，重跑得到逐字节相同的库，统计截图才可能前后对得上。
 *  2. 分级在写入时定死，不靠 UI 事后打标签：名单抄来的 = REAL_DATA，由产品推的分类 =
 *     AI_INFERENCE，专利等数值 = SYNTHETIC_DATA。否则"哪些数字是真的"无法回答。
 *  3. 聚合值只从已写入的行数出来，绝不单独再算一遍 —— 画像/看板上的数字与实际行数
 *     不一致，比数据少更糟。
 */

/** mulberry32。不用 Math.random：那样每次 seed 出的数字都不同，统计立刻对不上。 */
function prng(seedText: string): () => number {
  let a = parseInt(createHash('md5').update(seedText).digest('hex').slice(0, 8), 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type Db = TvdDb['db'];

const INDUSTRY_PROFILES: Record<string, { inventionBias: number; volume: [number, number] }> = {
  半导体与集成电路: { inventionBias: 0.78, volume: [18, 120] },
  生物医药与医疗器械: { inventionBias: 0.72, volume: [14, 96] },
  新材料: { inventionBias: 0.68, volume: [10, 70] },
  高端装备制造: { inventionBias: 0.52, volume: [12, 88] },
  光学光电子: { inventionBias: 0.62, volume: [10, 64] },
  软件与信息技术: { inventionBias: 0.58, volume: [6, 48] },
  新能源与储能: { inventionBias: 0.66, volume: [8, 60] },
  节能环保: { inventionBias: 0.44, volume: [6, 40] },
  汽车及零部件: { inventionBias: 0.38, volume: [10, 66] },
  航空航天与军工: { inventionBias: 0.7, volume: [8, 54] },
  化工: { inventionBias: 0.5, volume: [6, 44] },
  智能电网: { inventionBias: 0.56, volume: [8, 52] },
};

const INVENTOR_POOL = [
  '张伟', '王芳', '李强', '刘洋', '陈静', '杨帆', '赵磊', '黄敏', '周涛', '吴昊',
  '徐立', '孙宁', '马超', '朱斌', '胡跃', '郭鹏', '林峰', '何俊', '高翔', '罗成',
] as const;

const AGENCIES = [
  '北京集佳知识产权代理有限公司',
  '深圳市顺天专利商标代理事务所',
  '北京品源专利代理有限公司',
  '上海科盛知识产权代理有限公司',
];

const INDUSTRY_CODES: Record<string, string> = {
  半导体与集成电路: 'C39',
  生物医药与医疗器械: 'C27',
  新材料: 'C30',
  高端装备制造: 'C34',
  光学光电子: 'C39',
  软件与信息技术: 'I65',
  新能源与储能: 'C38',
  节能环保: 'N77',
  汽车及零部件: 'C36',
  航空航天与军工: 'C37',
  化工: 'C26',
  智能电网: 'C38',
};

/** 抽 n 个不重复发明人 —— 重复同名会让 tvd_patent_inventors 的唯一索引报错。 */
function sampleWithoutReplacement(rnd: () => number, n: number): string[] {
  const pool = [...INVENTOR_POOL];
  const out: string[] = [];
  for (let i = 0; i < n && pool.length > 0; i += 1) {
    out.push(...pool.splice(Math.floor(rnd() * pool.length), 1));
  }
  return out;
}

function pickOne<T>(rnd: () => number, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length) % list.length];
}

/** 专利标题由关键词拼装，一眼可辨是合成占位而非真实专利名。 */
function syntheticTitle(rnd: () => number, seed: DemoEnterpriseSeed): string {
  const head = pickOne(rnd, ['一种基于', '一种改进的', '一种集成式', '一种低损耗', '一种高可靠性']);
  const mid = pickOne(rnd, seed.keywords);
  const tail = pickOne(rnd, ['的方法及装置', '的结构与工艺', '控制系统', '组件及其制备方法', '检测系统']);
  return `${head}${mid}${tail}`;
}

export type SeedSummary = {
  enterprises: number;
  patents: number;
  signals: number;
  evidence: number;
  conclusionLinks: number;
  inventorLinks: number;
  sourceRecords: number;
  tracks: number;
  people: number;
  byDataKind: Record<string, number>;
};

/** 只用到 select/insert/delete，事务内外都能传。 */
type Scoped = Pick<Db, 'select' | 'insert' | 'delete'>;

async function clearScope(db: Scoped): Promise<void> {
  const scope = TVD_DEMO_SCOPE;
  const inScope = [eq(tvdEnterprises.tenantId, scope.tenantId), eq(tvdEnterprises.bankId, scope.bankId)] as const;
  const existing = await db
    .select({ id: tvdEnterprises.id })
    .from(tvdEnterprises)
    .where(and(...inScope));
  const ids = existing.map((r) => r.id);

  if (ids.length > 0) {
    // 由子表往父表清；tvd_patent_inventors 由 patents 的 cascade 带走。
    await db.delete(tvdPatents).where(inArray(tvdPatents.tvdEnterpriseId, ids));
    await db.delete(tvdPatentStats).where(inArray(tvdPatentStats.tvdEnterpriseId, ids));
    const signals = await db.select({ id: tvdSignals.id }).from(tvdSignals).where(inArray(tvdSignals.tvdEnterpriseId, ids));
    if (signals.length > 0) {
      await db.delete(tvdSignalSources).where(inArray(tvdSignalSources.signalId, signals.map((s) => s.id)));
    }
    await db.delete(tvdSignals).where(inArray(tvdSignals.tvdEnterpriseId, ids));
    await db.delete(tvdEnterpriseAliases).where(inArray(tvdEnterpriseAliases.tvdEnterpriseId, ids));
    await db.delete(tvdEnterpriseProfiles).where(inArray(tvdEnterpriseProfiles.tvdEnterpriseId, ids));
    await db.delete(tvdEnterprises).where(inArray(tvdEnterprises.id, ids));
  }

  // links 与 evidence 一起重建：只清 evidence 会让上一轮的绑定残留成悬空引用。
  await db
    .delete(tvdEvidenceLinks)
    .where(and(eq(tvdEvidenceLinks.tenantId, scope.tenantId), eq(tvdEvidenceLinks.bankId, scope.bankId)));
  // evidence 对 source_records 是 restrict，必须早于 records 删除。
  await db.delete(tvdEvidence).where(and(eq(tvdEvidence.tenantId, scope.tenantId), eq(tvdEvidence.bankId, scope.bankId)));
  await db.delete(tvdPeople).where(inArray(tvdPeople.id, INVENTOR_POOL.map((n) => uuidFrom(`person:${n}`))));
  await db.delete(tvdSourceRecords).where(and(eq(tvdSourceRecords.tenantId, scope.tenantId), eq(tvdSourceRecords.bankId, scope.bankId)));
  await db.delete(tvdDataSources).where(and(eq(tvdDataSources.tenantId, scope.tenantId), eq(tvdDataSources.bankId, scope.bankId)));
  await db.delete(tvdTracks).where(and(eq(tvdTracks.tenantId, scope.tenantId), eq(tvdTracks.bankId, scope.bankId)));
}

export async function seedTvdDemo(handle?: TvdDb): Promise<SeedSummary> {
  const h = handle ?? (await getTvdDb());
  const scope = TVD_DEMO_SCOPE;
  const base = {
    tenantId: scope.tenantId,
    bankId: scope.bankId,
    createdBy: scope.userId,
    updatedBy: scope.userId,
  };

  const summary: SeedSummary = {
    enterprises: 0,
    patents: 0,
    signals: 0,
    evidence: 0,
    conclusionLinks: 0,
    inventorLinks: 0,
    sourceRecords: 0,
    tracks: 0,
    people: 0,
    byDataKind: { REAL_DATA: 0, AI_INFERENCE: 0, SYNTHETIC_DATA: 0 },
  };

  // 单个事务：中途失败不留半套数据，演示库要么完整要么不动。
  await h.db.transaction(async (tx) => {
    await clearScope(tx);

    const source = DEMO_ENTERPRISE_SOURCES[0];
    const sourceId = uuidFrom(`ds:${source.code}`);
    await tx.insert(tvdDataSources).values({
      id: sourceId,
      ...base,
      code: source.code,
      name: source.name,
      tier: 'tier1_official',
      coversSignalTypes: ['enterprise_identity', 'product'],
      baseUrl: source.url,
      accessMethod: 'public_web_page',
      requiresAuth: false,
      requiresPaidLicense: false,
      usageConstraint: source.note,
      rateLimitPerMinute: 6,
      crawlAllowed: true,
      credibility: '0.850',
      connected: false,
      lastSyncAt: new Date(`${source.retrievedAt}T00:00:00Z`),
    });

    const recordId = uuidFrom(`sr:${source.code}`);
    await tx.insert(tvdSourceRecords).values({
      id: recordId,
      ...base,
      dataSourceId: sourceId,
      dataKind: 'REAL_DATA',
      url: source.retrievalUrl,
      documentNumber: '工业和信息化部 2019 年第一批专精特新“小巨人”名单',
      title: source.name,
      publisher: '工业和信息化部（名单）／公开转载页面（取表）',
      retrievedAt: new Date(`${source.retrievedAt}T00:00:00Z`),
      publishedAt: new Date('2019-06-13T00:00:00Z'),
      rawContent: DEMO_ENTERPRISES.map((e) => `${e.name}|${e.product}|${e.region}`).join('\n'),
      extracted: { rowCount: DEMO_ENTERPRISES.length, columns: ['name', 'product', 'region'] },
      contentHash: createHash('sha256').update(DEMO_ENTERPRISES.map((e) => e.name).join('|')).digest('hex'),
      accessMethod: 'public_web_page',
      permissionNote: '政府公开名单，可引用；取表用的是转载页面而非官方原文，故独立性只记 1 个来源。',
      verificationStatus: 'single_source',
      originRecordId: recordId,
      depth: 0,
    });
    summary.sourceRecords = 1;
    summary.byDataKind.REAL_DATA += 1;

    await tx.insert(tvdPeople).values(
      INVENTOR_POOL.map((name) => ({
        id: uuidFrom(`person:${name}`),
        ...base,
        name,
        nameNormalized: name,
        identityConfidence: 'low' as const,
        note: '演示发明人池：与任何真实发明人无关，仅用于支撑集中度类指标的可视化。',
      })),
    );
    summary.people = INVENTOR_POOL.length;

    // tvd_tracks 是"可投资主题"层级，用行业（12 个）而不是每家企业的细分领域（73 个）：
    // 后者每个赛道只有 1 家成员，对标与营销分组都失去意义。细分名仍留在 enterprises.trackName。
    const trackCounts = new Map<string, number>();
    for (const e of DEMO_ENTERPRISES) trackCounts.set(e.industry, (trackCounts.get(e.industry) ?? 0) + 1);
    const trackCodeByIndustry = new Map<string, string>();
    let trackSeq = 0;
    await tx.insert(tvdTracks).values(
      [...trackCounts.entries()].map(([name, count]) => {
        trackSeq += 1;
        const code = `TRK${String(trackSeq).padStart(3, '0')}`;
        trackCodeByIndustry.set(name, code);
        return {
          id: uuidFrom(`track:${name}`),
          ...base,
          code,
          name,
          description: `演示主题：本语料中该行业企业 ${count} 家。`,
          nodeCodes: [],
          industryCodes: [
            ...new Set(
              DEMO_ENTERPRISES.filter((e) => e.industry === name).map((e) => INDUSTRY_CODES[e.industry] ?? 'C34'),
            ),
          ],
          policyHeat: 'high',
          bankPriority: 'medium',
          enterpriseCount: count,
        };
      }),
    );
    summary.tracks = trackSeq;

    type PatentInsert = typeof tvdPatents.$inferInsert;
    type InventorLink = typeof tvdPatentInventors.$inferInsert;
    const patents: PatentInsert[] = [];
    const inventorLinks: InventorLink[] = [];
    const statsRows: typeof tvdPatentStats.$inferInsert[] = [];
    let patentSeq = 0;

    for (const e of DEMO_ENTERPRISES) {
      const tvdId = uuidFrom(`tvd-ent:${e.name}`);
      const rnd = prng(e.name);
      const profile = INDUSTRY_PROFILES[e.industry] ?? { inventionBias: 0.5, volume: [6, 40] };
      const industryCode = INDUSTRY_CODES[e.industry] ?? 'C34';

      await tx.insert(tvdEnterprises).values({
        id: tvdId,
        enterpriseId: uuidFrom(`legacy-ent:${e.name}`),
        ...base,
        dataKind: 'REAL_DATA',
        displayName: e.name,
        unifiedCode: null,
        industryCode,
        industryName: e.industry,
        trackCode: trackCodeByIndustry.get(e.industry) ?? e.industry,
        trackName: e.track,
        regionCode: e.region,
        regionName: e.region,
        stage: '成长',
        qualifications: ['专精特新小巨人'],
        qualificationEvidence: { 专精特新小巨人: [recordId] },
        coreTechSummary: `主导产品：${e.product}`,
        techKeywords: e.keywords,
        identityConfidence: 'medium',
        verificationStatus: 'single_source',
      });
      summary.enterprises += 1;
      summary.byDataKind.REAL_DATA += 1;

      await tx.insert(tvdEnterpriseAliases).values({
        id: uuidFrom(`alias:${e.name}`),
        tvdEnterpriseId: tvdId,
        ...base,
        alias: e.name,
        aliasKind: 'legal_name',
        normalizedAlias: e.name.replace(/[（）()·\s]/g, ''),
        sourceRecordId: recordId,
        dataKind: 'REAL_DATA',
      });

      const signalRows: { sid: string; type: 'enterprise_identity' | 'product'; subject: string; text: string }[] = [
        { sid: uuidFrom(`sig-id:${e.name}`), type: 'enterprise_identity', subject: '专精特新小巨人认定', text: e.name },
        { sid: uuidFrom(`sig-pd:${e.name}`), type: 'product', subject: '主导产品', text: e.product },
      ];
      for (const s of signalRows) {
        await tx.insert(tvdSignals).values({
          id: s.sid,
          tvdEnterpriseId: tvdId,
          ...base,
          dataKind: 'REAL_DATA',
          signalType: s.type,
          subject: s.subject,
          textValue: s.text,
          occurredAt: new Date('2019-06-13T00:00:00Z'),
          attributes: { region: e.region, city: e.city, batch: e.batch },
          normalizedKey: `${s.type}:${s.subject}`,
          dedupKey: uuidFrom(`${s.type}:${s.text}`).slice(0, 16),
          confidence: '0.850',
          verificationStatus: 'single_source',
          sourceCount: 1,
          independentSourceCount: 1,
        });
        await tx.insert(tvdSignalSources).values({
          id: uuidFrom(`ss:${s.sid}`),
          signalId: s.sid,
          sourceRecordId: recordId,
          ...base,
          role: 'primary',
          excerpt: `${e.name}｜${e.product}`,
        });
        const evidenceId = uuidFrom(`ev:${s.sid}`);
        await tx.insert(tvdEvidence).values({
          id: evidenceId,
          tvdEnterpriseId: tvdId,
          sourceRecordId: recordId,
          ...base,
          dataKind: 'REAL_DATA',
          claimText: `${e.name} 的${s.subject}为「${s.text}」`,
          excerpt: `${e.name}|${e.product}|${e.region}`,
          locator: { table: '第一批专精特新“小巨人”企业名单', row: DEMO_ENTERPRISES.indexOf(e) + 1 },
          credibility: '0.850',
          verificationStatus: 'single_source',
          originRecordId: recordId,
        });
        // 结论↔证据的显式绑定：一条来源同时支撑两个结论时，只有这一行能说明
        // "哪条证据服务哪条结论"，否则详情页每个信号都会显示整条来源的全部证据。
        await tx.insert(tvdEvidenceLinks).values({
          id: uuidFrom(`el:signal:${s.sid}`),
          evidenceId,
          ...base,
          conclusionKind: 'signal',
          conclusionId: s.sid,
          role: 'primary',
        });
        summary.signals += 1;
        summary.evidence += 1;
        summary.conclusionLinks += 1;
        summary.byDataKind.REAL_DATA += 2;
      }

      // 画像先不落分：评分必须由确定性评分器写入，seed 阶段给分数等于伪造结论。
      await tx.insert(tvdEnterpriseProfiles).values({
        id: uuidFrom(`prof:${e.name}`),
        tvdEnterpriseId: tvdId,
        ...base,
        profileVersion: 'v1',
        overallScore: null,
        dataCoverage: '0.350',
        identityLayer: { name: e.name, region: e.region, city: e.city, sourceRecordId: recordId },
        techIdentityLayer: { industry: e.industry, track: e.track, keywords: e.keywords },
        evidenceLayer: { evidenceCount: signalRows.length, independentSources: 1 },
        openQuestions: ['统一社会信用代码未采集', '研发投入与财务数据未采集', '专利数据为合成演示值'],
        pendingVerificationCount: 3,
        dataKind: 'AI_INFERENCE',
      });
      summary.byDataKind.AI_INFERENCE += 1;

      const total = Math.round(profile.volume[0] + rnd() * (profile.volume[1] - profile.volume[0]));
      const byYear: Record<string, number> = {};
      const byDomain: Record<string, number> = {};
      let invention = 0;
      let utility = 0;
      let design = 0;
      let granted = 0;
      let pending = 0;
      let invalid = 0;
      let recent = 0;

      for (let i = 0; i < total; i += 1) {
        patentSeq += 1;
        const isInvention = rnd() < profile.inventionBias;
        const isDesign = !isInvention && rnd() < 0.3;
        const patentType = isInvention ? 'invention' : isDesign ? 'design' : 'utility_model';
        const year = 2010 + Math.floor(rnd() * 15);
        const statusRoll = rnd();
        const legalStatus =
          statusRoll < 0.62 ? 'granted' : statusRoll < 0.8 ? 'pending' : statusRoll < 0.92 ? 'lapsed' : 'rejected';

        if (isInvention) invention += 1;
        else if (isDesign) design += 1;
        else utility += 1;
        if (legalStatus === 'granted') granted += 1;
        if (legalStatus === 'pending') pending += 1;
        if (legalStatus === 'lapsed' || legalStatus === 'rejected') invalid += 1;
        if (year >= 2022) recent += 1;
        byYear[String(year)] = (byYear[String(year)] ?? 0) + 1;
        const domain = pickOne(rnd, e.keywords);
        byDomain[domain] = (byDomain[domain] ?? 0) + 1;

        const id = uuidFrom(`pat:${e.name}:${i}`);
        const inventors = sampleWithoutReplacement(rnd, 1 + Math.floor(rnd() * 5));

        patents.push({
          id,
          tvdEnterpriseId: tvdId,
          ...base,
          dataKind: 'SYNTHETIC_DATA',
          verificationStatus: 'unverified',
          // 序号进公开号：随机号段会撞 tvd_patents_publication_uniq。
          publicationNumber: `CN${String(120000000 + patentSeq)}${patentType === 'invention' ? 'B' : 'U'}`,
          applicationNumber: `CN20${String(year).slice(2)}${String(10000000 + patentSeq)}${String(Math.floor(rnd() * 10))}`,
          title: syntheticTitle(rnd, e),
          patentType,
          legalStatus,
          filingDate: new Date(Date.UTC(year, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))),
          publicationDate: new Date(Date.UTC(year, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))),
          grantDate: legalStatus === 'granted' ? new Date(Date.UTC(year + 1, Math.floor(rnd() * 12), 1)) : null,
          statusUpdatedAt: new Date(Date.UTC(year + 1, Math.floor(rnd() * 12), 1)),
          applicantRaw: e.name,
          applicantNormalized: e.name,
          isCurrentApplicant: true,
          assigneeHistory: [],
          inventorCount: inventors.length,
          inventorNamesRaw: inventors,
          agency: rnd() < 0.6 ? pickOne(rnd, AGENCIES) : null,
          ipcCodes: [`${industryCode}${String(10 + Math.floor(rnd() * 89))}`],
          techDomains: [domain],
          abstractText: `本发明涉及${domain}领域，具体涉及${syntheticTitle(rnd, e)}。（合成演示文本，非真实摘要）`,
          claimCount: 1 + Math.floor(rnd() * 12),
          familySize: rnd() < 0.15 ? 2 + Math.floor(rnd() * 3) : 1,
          citedByCount: Math.floor(rnd() * rnd() * 40),
          sourceRecordId: null,
        });

        inventors.forEach((name, pos) => {
          inventorLinks.push({
            id: uuidFrom(`pinv:${id}:${name}`),
            patentId: id,
            personId: uuidFrom(`person:${name}`),
            ...base,
            role: 'inventor',
            position: pos,
            nameAsFiled: name,
          });
        });
      }

      statsRows.push({
        id: uuidFrom(`pstat:${e.name}`),
        tvdEnterpriseId: tvdId,
        ...base,
        total,
        inventionCount: invention,
        utilityModelCount: utility,
        designCount: design,
        grantedCount: granted,
        pendingCount: pending,
        invalidCount: invalid,
        validInventionRatio: (invention / total).toFixed(3),
        avgQualityScore: null,
        recentFilingRatio: (recent / total).toFixed(3),
        originalRatio: null,
        anomalyCount: 0,
        byTechDomain: byDomain,
        byYear,
        ruleVersion: 'v1',
      });
      summary.patents += total;
      summary.byDataKind.SYNTHETIC_DATA += total;
    }

    for (const rows of chunk(patents, 200)) await tx.insert(tvdPatents).values(rows);
    for (const rows of chunk(inventorLinks, 200)) await tx.insert(tvdPatentInventors).values(rows);
    for (const rows of chunk(statsRows, 100)) await tx.insert(tvdPatentStats).values(rows);
    summary.inventorLinks = inventorLinks.length;
  });

  return summary;
}
