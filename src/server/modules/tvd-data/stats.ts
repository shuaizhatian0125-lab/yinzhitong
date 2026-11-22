import { and, count, countDistinct, eq, gt, isNull } from 'drizzle-orm';
import { getTvdDb, type TvdDb } from '@/storage/database/tvd/client';
import { tvdEnterpriseProfiles, tvdEnterprises, tvdPatents, tvdSignals } from '@/storage/database/tvd';
import type { TvdScope } from './scope';

/**
 * TVD 行数与看板统计。
 *
 * 页面上出现的每个数字都必须来自这里的 count()，不允许再写常量 ——
 * 之前 560/180/23 就是硬编码的装饰值，跟库里的实际行数毫无关系。
 */

const CHECK_TABLES = [
  'tvd_enterprises',
  'tvd_enterprise_aliases',
  'tvd_enterprise_profiles',
  'tvd_data_sources',
  'tvd_source_records',
  'tvd_signals',
  'tvd_signal_sources',
  'tvd_evidence',
  'tvd_evidence_links',
  'tvd_people',
  'tvd_patents',
  'tvd_patent_inventors',
  'tvd_patent_stats',
  'tvd_tracks',
  // 评分侧：run 数与分项数必须能对上"企业数 × 规则版本数 × 30 项"，
  // 少一项就说明某家企业的评分半途失败。
  'tvd_assessment_models',
  'tvd_assessment_model_versions',
  'tvd_assessment_indicators',
  'tvd_assessment_runs',
  'tvd_assessment_scores',
  'tvd_score_evidence_links',
] as const;

export type TvdRowCounts = Partial<Record<(typeof CHECK_TABLES)[number], number>>;

export async function countTvdRows(handle?: TvdDb): Promise<TvdRowCounts> {
  const h = handle ?? (await getTvdDb());
  const out: TvdRowCounts = {};
  for (const table of CHECK_TABLES) {
    // 表名来自上面的常量白名单，不接外部输入。
    const rows = await h.query<{ n: number }>(`select count(*)::int as n from "${table}"`);
    out[table] = Number(rows[0]?.n ?? 0);
  }
  return out;
}

export type EnterpriseBoardStats = {
  enterprises: number;
  patents: number;
  pendingVerification: number;
  demo: true;
};

export async function getEnterpriseBoardStats(
  scope: TvdScope,
  handle?: TvdDb,
): Promise<EnterpriseBoardStats> {
  const h = handle ?? (await getTvdDb());
  const db = h.db;
  const inScope = [
    eq(tvdEnterprises.tenantId, scope.tenantId),
    eq(tvdEnterprises.bankId, scope.bankId),
    eq(tvdEnterprises.status, 'active'),
  ];

  const enterprises = await db
    .select({ n: count() })
    .from(tvdEnterprises)
    .where(and(...inScope));

  const patents = await db
    .select({ n: count() })
    .from(tvdPatents)
    .where(
      and(
        eq(tvdPatents.tenantId, scope.tenantId),
        eq(tvdPatents.bankId, scope.bankId),
        eq(tvdPatents.status, 'active'),
      ),
    );

  // 口径是"企业数"，不是"画像行数"：评分器产出新版画像后，同一企业会有两行
  // （seed 的空画像 + 评分画像），只数行会把 73 家报成 146 家。
  // 因此限定当前生效画像，并按企业去重。
  const pending = await db
    .select({ n: countDistinct(tvdEnterpriseProfiles.tvdEnterpriseId) })
    .from(tvdEnterpriseProfiles)
    .where(
      and(
        eq(tvdEnterpriseProfiles.tenantId, scope.tenantId),
        eq(tvdEnterpriseProfiles.bankId, scope.bankId),
        gt(tvdEnterpriseProfiles.pendingVerificationCount, 0),
        isNull(tvdEnterpriseProfiles.effectiveTo),
      ),
    );

  return {
    enterprises: Number(enterprises[0]?.n ?? 0),
    patents: Number(patents[0]?.n ?? 0),
    pendingVerification: Number(pending[0]?.n ?? 0),
    demo: true,
  };
}

export type SignalCoverageRow = {
  signal_type: string;
  data_kind: string;
  count: number;
};

/**
 * 库里实际有哪些信号类型、分别是什么数据分级。
 *
 * 数据源目录用它对照"连接器声称能采的"和"实际落库的"，
 * 两边对不上的类型就是缺口 —— 缺口要显示成缺口，不能靠文案遮掉。
 */
export async function getSignalTypeCoverage(
  scope: TvdScope,
  handle?: TvdDb,
): Promise<SignalCoverageRow[]> {
  const h = handle ?? (await getTvdDb());
  const rows = await h.db
    .select({
      signal_type: tvdSignals.signalType,
      data_kind: tvdSignals.dataKind,
      n: count(),
    })
    .from(tvdSignals)
    .where(
      and(
        eq(tvdSignals.tenantId, scope.tenantId),
        eq(tvdSignals.bankId, scope.bankId),
        eq(tvdSignals.status, 'active'),
      ),
    )
    .groupBy(tvdSignals.signalType, tvdSignals.dataKind);

  return rows.map((r) => ({
    signal_type: String(r.signal_type),
    data_kind: String(r.data_kind),
    count: Number(r.n),
  }));
}
