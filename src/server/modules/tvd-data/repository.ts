import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { getTvdDb, type TvdDb } from '@/storage/database/tvd/client';
import {
  tvdEvidence,
  tvdEvidenceLinks,
  tvdEnterpriseProfiles,
  tvdEnterprises,
  tvdPatentStats,
  tvdPatents,
  tvdSignalSources,
  tvdSignals,
  tvdSourceRecords,
  tvdDataSources,
  verificationStatusEnum,
} from '@/storage/database/tvd';
import type { TvdScope } from './scope';

/** 与 core.ts 的 tvd_verification_status 同一份取值，避免字符串到处飘。 */
type TvdVerification = (typeof verificationStatusEnum.enumValues)[number];

/**
 * TVD 企业读取层。
 *
 * 只读、只按作用域过滤、分页在库里做 —— 演示语料上千行，拉到内存再切片
 * 会让分页数字与库里的 total 不一致，而"数字对不上"正是这次要修的问题。
 */

export type TvdEnterpriseListFilter = {
  keyword?: string;
  region?: string;
  industry?: string;
  track?: string;
  /** 核验状态直接取 tvd_enterprises.verification_status，前端下拉的取值来自库里真实出现过的值。 */
  verification?: TvdVerification;
  page: number;
  pageSize: number;
};

export type TvdEnterpriseListItem = {
  id: string;
  name: string;
  industry: string | null;
  track: string | null;
  region: string | null;
  qualifications: string[];
  techKeywords: string[];
  /** 专利三项来自 tvd_patent_stats 的聚合行；没有行说明该企业本语料内无专利，不是 0 分。 */
  patentTotal: number | null;
  inventionCount: number | null;
  validInventionRatio: string | null;
  /** 评分由确定性评分器写入；null 表示"尚未评估"，前端必须显示"待评分"而不是 0。 */
  overallScore: string | null;
  dataCoverage: string | null;
  pendingVerification: number;
  verificationStatus: string;
  dataKind: string;
  updatedAt: string;
};

export type TvdEnterpriseListResult = {
  items: TvdEnterpriseListItem[];
  total: number;
  page: number;
  pageSize: number;
};

function scopeConditions(scope: TvdScope) {
  return [
    eq(tvdEnterprises.tenantId, scope.tenantId),
    eq(tvdEnterprises.bankId, scope.bankId),
    eq(tvdEnterprises.status, 'active'),
  ];
}

/**
 * 筛选条件全部落在 tvd_enterprises 自己的列上，不引入 join ——
 * 分页前的 count() 与列表用的是同一个 where，一旦有条件来自连接表，
 * 就会出现"共 N 家"和实际行数对不上。
 */
function filterConditions(filter: TvdEnterpriseListFilter) {
  const conds = [];
  if (filter.region) conds.push(eq(tvdEnterprises.regionName, filter.region));
  if (filter.industry) conds.push(eq(tvdEnterprises.industryName, filter.industry));
  if (filter.track) conds.push(eq(tvdEnterprises.trackName, filter.track));
  if (filter.verification) conds.push(eq(tvdEnterprises.verificationStatus, filter.verification));
  if (filter.keyword) {
    const pattern = `%${filter.keyword}%`;
    conds.push(
      or(
        ilike(tvdEnterprises.displayName, pattern),
        ilike(tvdEnterprises.coreTechSummary, pattern),
        sql`${tvdEnterprises.techKeywords}::text ilike ${pattern}`,
      ),
    );
  }
  return conds;
}

export async function listTvdEnterprises(
  scope: TvdScope,
  filter: TvdEnterpriseListFilter,
  handle?: TvdDb,
): Promise<TvdEnterpriseListResult> {
  const h = handle ?? (await getTvdDb());
  const db = h.db;
  const where = and(...scopeConditions(scope), ...filterConditions(filter));

  const totalRows = await db.select({ n: count() }).from(tvdEnterprises).where(where);
  const total = Number(totalRows[0]?.n ?? 0);

  const rows = await db
    .select({
      id: tvdEnterprises.id,
      name: tvdEnterprises.displayName,
      industry: tvdEnterprises.industryName,
      track: tvdEnterprises.trackName,
      region: tvdEnterprises.regionName,
      qualifications: tvdEnterprises.qualifications,
      techKeywords: tvdEnterprises.techKeywords,
      verificationStatus: tvdEnterprises.verificationStatus,
      dataKind: tvdEnterprises.dataKind,
      updatedAt: tvdEnterprises.updatedAt,
      patentTotal: tvdPatentStats.total,
      inventionCount: tvdPatentStats.inventionCount,
      validInventionRatio: tvdPatentStats.validInventionRatio,
      overallScore: tvdEnterpriseProfiles.overallScore,
      dataCoverage: tvdEnterpriseProfiles.dataCoverage,
      pendingVerification: tvdEnterpriseProfiles.pendingVerificationCount,
    })
    .from(tvdEnterprises)
    .leftJoin(
      tvdPatentStats,
      and(eq(tvdPatentStats.tvdEnterpriseId, tvdEnterprises.id), eq(tvdPatentStats.ruleVersion, 'v1')),
    )
    .leftJoin(
      tvdEnterpriseProfiles,
      and(
        eq(tvdEnterpriseProfiles.tvdEnterpriseId, tvdEnterprises.id),
        // 取"当前生效"的那条画像，不锁 profileVersion='v1'：
        // 评分器产出的是以规则版本命名的新画像并让旧画像失效，
        // 锁死 v1 会让看板永远读到 seed 那条空画像，分数列一直显示"待评分"。
        isNull(tvdEnterpriseProfiles.effectiveTo),
      ),
    )
    .where(where)
    .orderBy(asc(tvdEnterprises.displayName))
    .limit(filter.pageSize)
    .offset((filter.page - 1) * filter.pageSize);

  const items: TvdEnterpriseListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    industry: r.industry,
    track: r.track,
    region: r.region,
    qualifications: r.qualifications ?? [],
    techKeywords: r.techKeywords ?? [],
    patentTotal: r.patentTotal,
    inventionCount: r.inventionCount,
    validInventionRatio: r.validInventionRatio,
    overallScore: r.overallScore,
    dataCoverage: r.dataCoverage,
    pendingVerification: Number(r.pendingVerification ?? 0),
    verificationStatus: r.verificationStatus,
    dataKind: r.dataKind,
    updatedAt: (r.updatedAt ?? new Date()).toISOString(),
  }));

  return { items, total, page: filter.page, pageSize: filter.pageSize };
}

/** 筛选项直接从数据里取，避免前端写死一份与库里不符的下拉列表。 */
export async function getTvdFacets(
  scope: TvdScope,
  handle?: TvdDb,
): Promise<{ regions: string[]; industries: string[]; tracks: string[]; verifications: string[] }> {
  const h = handle ?? (await getTvdDb());
  const db = h.db;
  const scopeOnly = and(...scopeConditions(scope));

  const [regions, industries, tracks, verifications] = await Promise.all([
    db.selectDistinct({ v: tvdEnterprises.regionName }).from(tvdEnterprises).where(scopeOnly),
    db.selectDistinct({ v: tvdEnterprises.industryName }).from(tvdEnterprises).where(scopeOnly),
    db.selectDistinct({ v: tvdEnterprises.trackName }).from(tvdEnterprises).where(scopeOnly),
    db.selectDistinct({ v: tvdEnterprises.verificationStatus }).from(tvdEnterprises).where(scopeOnly),
  ]);

  const clean = (rows: { v: string | null }[]) =>
    rows.map((r) => r.v).filter((v): v is string => Boolean(v)).sort((a, b) => a.localeCompare(b, 'zh-CN'));

  return {
    regions: clean(regions),
    industries: clean(industries),
    tracks: clean(tracks),
    verifications: clean(verifications),
  };
}

export type TvdEnterpriseDetail = {
  enterprise: {
    id: string;
    name: string;
    industry: string | null;
    track: string | null;
    region: string | null;
    stage: string | null;
    qualifications: string[];
    techKeywords: string[];
    coreTechSummary: string | null;
    identityConfidence: string;
    verificationStatus: string;
    dataKind: string;
  };
  profile: {
    overallScore: string | null;
    scoreConfidence: string | null;
    dataCoverage: string | null;
    evidenceConfidence: string | null;
    profileVersion: string;
    identityLayer: Record<string, unknown>;
    techIdentityLayer: Record<string, unknown>;
    evidenceLayer: Record<string, unknown>;
    growthLayer: Record<string, unknown>;
    riskLayer: Record<string, unknown>;
    openQuestions: string[];
    pendingVerificationCount: number;
    conflictCount: number;
  } | null;
  patentStats: {
    total: number;
    inventionCount: number;
    utilityModelCount: number;
    designCount: number;
    grantedCount: number;
    pendingCount: number;
    invalidCount: number;
    validInventionRatio: string | null;
    recentFilingRatio: string | null;
    avgQualityScore: string | null;
    anomalyCount: number;
    byYear: Record<string, unknown>;
    byTechDomain: Record<string, unknown>;
    ruleVersion: string;
  } | null;
  recentPatents: Array<{
    id: string;
    publicationNumber: string;
    title: string;
    patentType: string;
    legalStatus: string;
    filingDate: string | null;
    citedByCount: number;
    claimCount: number;
    techDomains: string[];
    inventorNames: string[];
    dataKind: string;
  }>;
  signals: Array<{
    id: string;
    signalType: string;
    subject: string;
    textValue: string | null;
    observedValue: string | null;
    valueUnit: string | null;
    occurredAt: string | null;
    confidence: string;
    verificationStatus: string;
    independentSourceCount: number;
    dataKind: string;
    evidence: Array<{
      evidenceId: string;
      claimText: string;
      excerpt: string | null;
      credibility: string;
      sourceRecordId: string;
      sourceTitle: string | null;
      sourceUrl: string | null;
      sourceTier: string | null;
      sourceName: string | null;
      publisher: string | null;
      publishedAt: string | null;
      retrievedAt: string | null;
      accessMethod: string | null;
      originRecordId: string | null;
    }>;
  }>;
};

/**
 * 单企业全景。
 *
 * 证据链一次性带到前端：画像上每条结论都要能点开看"哪条来源、哪段原文"，
 * 如果这里只给数量，前端就只能显示"有 2 条证据"这种无法核对的东西。
 */
export async function getTvdEnterpriseDetail(
  scope: TvdScope,
  enterpriseUuid: string,
  handle?: TvdDb,
): Promise<TvdEnterpriseDetail | null> {
  const h = handle ?? (await getTvdDb());
  const db = h.db;
  const inScope = and(...scopeConditions(scope), eq(tvdEnterprises.id, enterpriseUuid));

  const entRows = await db.select().from(tvdEnterprises).where(inScope).limit(1);
  const ent = entRows[0];
  if (!ent) return null;

  const [profileRows, statsRows, patentRows, signalRows] = await Promise.all([
    db
      .select()
      .from(tvdEnterpriseProfiles)
      .where(and(eq(tvdEnterpriseProfiles.tvdEnterpriseId, ent.id), isNull(tvdEnterpriseProfiles.effectiveTo)))
      .orderBy(desc(tvdEnterpriseProfiles.createdAt))
      .limit(1),
    db.select().from(tvdPatentStats).where(and(eq(tvdPatentStats.tvdEnterpriseId, ent.id), eq(tvdPatentStats.ruleVersion, 'v1'))).limit(1),
    db
      .select()
      .from(tvdPatents)
      .where(eq(tvdPatents.tvdEnterpriseId, ent.id))
      .orderBy(desc(tvdPatents.filingDate))
      .limit(20),
    db.select().from(tvdSignals).where(and(eq(tvdSignals.tvdEnterpriseId, ent.id), eq(tvdSignals.status, 'active'))),
  ]);

  /**
   * 信号 → 证据 → 来源，三级串起来。
   *
   * 归属以 tvd_evidence_links（conclusion_kind='signal'）为准：一条来源常同时支撑
   * 同一企业的多个结论，若只按 source_record 归并，每个信号都会看到整条来源的
   * 全部证据，"这条结论有几条证据"就虚高，而这个数字正是双源门槛的输入。
   * 没有绑定行的老数据退回按来源归并，至少不会显示成"无证据"。
   * 这一层若省掉，前端就只能显示"有 2 条证据"，点不开原文，等于没有溯源。
   */
  type EvidenceOut = TvdEnterpriseDetail['signals'][number]['evidence'][number];
  const signalEvidence = new Map<string, EvidenceOut[]>();

  if (signalRows.length > 0) {
    const signalIds = signalRows.map((s) => s.id);

    const [bindingRows, linkRows, evRows] = await Promise.all([
      db
        .select({
          conclusionId: tvdEvidenceLinks.conclusionId,
          evidenceId: tvdEvidenceLinks.evidenceId,
        })
        .from(tvdEvidenceLinks)
        .where(
          and(
            eq(tvdEvidenceLinks.conclusionKind, 'signal'),
            inArray(tvdEvidenceLinks.conclusionId, signalIds),
            eq(tvdEvidenceLinks.tenantId, scope.tenantId),
            eq(tvdEvidenceLinks.bankId, scope.bankId),
          ),
        ),
      db
        .select({
          signalId: tvdSignalSources.signalId,
          sourceRecordId: tvdSignalSources.sourceRecordId,
        })
        .from(tvdSignalSources)
        .where(inArray(tvdSignalSources.signalId, signalIds)),
      db
        .select({
          evidenceId: tvdEvidence.id,
          sourceRecordId: tvdEvidence.sourceRecordId,
          claimText: tvdEvidence.claimText,
          excerpt: tvdEvidence.excerpt,
          credibility: tvdEvidence.credibility,
          originRecordId: tvdEvidence.originRecordId,
        })
        .from(tvdEvidence)
        .where(
          and(
            eq(tvdEvidence.tvdEnterpriseId, ent.id),
            eq(tvdEvidence.status, 'active'),
          ),
        ),
    ]);

    const recordIds = [...new Set([...evRows.map((e) => e.sourceRecordId), ...linkRows.map((l) => l.sourceRecordId)])];

    if (recordIds.length > 0) {
      const recRows = await db
        .select({
          id: tvdSourceRecords.id,
          title: tvdSourceRecords.title,
          url: tvdSourceRecords.url,
          publisher: tvdSourceRecords.publisher,
          publishedAt: tvdSourceRecords.publishedAt,
          retrievedAt: tvdSourceRecords.retrievedAt,
          accessMethod: tvdSourceRecords.accessMethod,
          dataSourceId: tvdSourceRecords.dataSourceId,
        })
        .from(tvdSourceRecords)
        .where(inArray(tvdSourceRecords.id, recordIds));

      const srcRows = await db
        .select({
          id: tvdDataSources.id,
          name: tvdDataSources.name,
          tier: tvdDataSources.tier,
        })
        .from(tvdDataSources)
        .where(inArray(tvdDataSources.id, [...new Set(recRows.map((r) => r.dataSourceId))]));

      const recordById = new Map(recRows.map((r) => [r.id, r]));
      const sourceById = new Map(srcRows.map((s) => [s.id, s]));

      const toOut = (e: (typeof evRows)[number]): EvidenceOut => {
        const rec = recordById.get(e.sourceRecordId);
        const src = rec ? sourceById.get(rec.dataSourceId) : undefined;
        return {
          evidenceId: e.evidenceId,
          sourceRecordId: e.sourceRecordId,
          claimText: e.claimText,
          excerpt: e.excerpt,
          credibility: e.credibility,
          originRecordId: e.originRecordId,
          sourceTitle: rec?.title ?? null,
          sourceUrl: rec?.url ?? null,
          sourceTier: src?.tier ?? null,
          sourceName: src?.name ?? null,
          publisher: rec?.publisher ?? null,
          publishedAt: rec?.publishedAt?.toISOString() ?? null,
          retrievedAt: rec?.retrievedAt?.toISOString() ?? null,
          accessMethod: rec?.accessMethod ?? null,
        };
      };

      const evidenceById = new Map(evRows.map((e) => [e.evidenceId, e]));
      const recordsBySignal = new Map<string, string[]>();
      for (const l of linkRows) {
        recordsBySignal.set(l.signalId, [...(recordsBySignal.get(l.signalId) ?? []), l.sourceRecordId]);
      }

      for (const b of bindingRows) {
        const e = evidenceById.get(b.evidenceId);
        if (!e) continue;
        signalEvidence.set(b.conclusionId, [...(signalEvidence.get(b.conclusionId) ?? []), toOut(e)]);
      }

      for (const [signalId, recIds] of recordsBySignal) {
        if (signalEvidence.has(signalId)) continue;
        signalEvidence.set(
          signalId,
          evRows.filter((e) => recIds.includes(e.sourceRecordId)).map(toOut),
        );
      }
    }
  }

  return {
    enterprise: {
      id: ent.id,
      name: ent.displayName,
      industry: ent.industryName,
      track: ent.trackName,
      region: ent.regionName,
      stage: ent.stage,
      qualifications: ent.qualifications ?? [],
      techKeywords: ent.techKeywords ?? [],
      coreTechSummary: ent.coreTechSummary,
      identityConfidence: ent.identityConfidence,
      verificationStatus: ent.verificationStatus,
      dataKind: ent.dataKind,
    },
    profile: profileRows[0]
      ? {
          overallScore: profileRows[0].overallScore,
          scoreConfidence: profileRows[0].scoreConfidence,
          dataCoverage: profileRows[0].dataCoverage,
          evidenceConfidence: profileRows[0].evidenceConfidence,
          profileVersion: profileRows[0].profileVersion,
          identityLayer: profileRows[0].identityLayer,
          techIdentityLayer: profileRows[0].techIdentityLayer,
          evidenceLayer: profileRows[0].evidenceLayer,
          growthLayer: profileRows[0].growthLayer,
          riskLayer: profileRows[0].riskLayer,
          openQuestions: profileRows[0].openQuestions ?? [],
          pendingVerificationCount: profileRows[0].pendingVerificationCount,
          conflictCount: profileRows[0].conflictCount,
        }
      : null,
    patentStats: statsRows[0]
      ? {
          total: statsRows[0].total,
          inventionCount: statsRows[0].inventionCount,
          utilityModelCount: statsRows[0].utilityModelCount,
          designCount: statsRows[0].designCount,
          grantedCount: statsRows[0].grantedCount,
          pendingCount: statsRows[0].pendingCount,
          invalidCount: statsRows[0].invalidCount,
          validInventionRatio: statsRows[0].validInventionRatio,
          recentFilingRatio: statsRows[0].recentFilingRatio,
          avgQualityScore: statsRows[0].avgQualityScore,
          anomalyCount: statsRows[0].anomalyCount,
          byYear: statsRows[0].byYear,
          byTechDomain: statsRows[0].byTechDomain,
          ruleVersion: statsRows[0].ruleVersion,
        }
      : null,
    recentPatents: patentRows.map((p) => ({
      id: p.id,
      publicationNumber: p.publicationNumber,
      title: p.title,
      patentType: p.patentType,
      legalStatus: p.legalStatus,
      filingDate: p.filingDate ? p.filingDate.toISOString() : null,
      citedByCount: p.citedByCount,
      claimCount: p.claimCount,
      techDomains: p.techDomains ?? [],
      inventorNames: p.inventorNamesRaw ?? [],
      dataKind: p.dataKind,
    })),
    signals: signalRows.map((s) => ({
      id: s.id,
      signalType: s.signalType,
      subject: s.subject,
      textValue: s.textValue,
      observedValue: s.observedValue,
      valueUnit: s.valueUnit,
      occurredAt: s.occurredAt ? s.occurredAt.toISOString() : null,
      confidence: s.confidence,
      verificationStatus: s.verificationStatus,
      independentSourceCount: s.independentSourceCount,
      dataKind: s.dataKind,
      evidence: signalEvidence.get(s.id) ?? [],
    })),
  };
}

