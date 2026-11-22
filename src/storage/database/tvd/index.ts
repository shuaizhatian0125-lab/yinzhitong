/**
 * TVD（科技型企业价值发现）数据模型入口。
 *
 * 与既有 db/schema.sql 的关系：legacy 表不动，本模块只新增 tvd_* 前缀表。
 * 见 schema-enterprise.ts 顶部关于「为何不引用 legacy enterprise 外键」的说明
 * —— 本地演示引擎 PGlite 无法加载 db/schema.sql（它第 12 行 CREATE EXTENSION vector，
 * 而 PGlite 0.5.17 未捆绑 pgvector），因此指向 legacy 表的完整性由仓储层保证，
 * 部署到真实 PostgreSQL 时再补外键。
 *
 * tvdSchema 的键顺序即外键依赖拓扑序，迁移器按它建表、按逆序回滚。
 * 只维护这一份清单，tvdTables 由它派生，避免两处清单漂移。
 */
import { tvdAssessmentIndicators, tvdAssessmentModelVersions, tvdAssessmentModels, tvdAssessmentRuns, tvdAssessmentScores, tvdScoreEvidenceLinks } from './schema-assessment';
import { tvdEnterpriseChainPositions, tvdIndustryEdges, tvdIndustryNodes, tvdTracks } from './schema-domain';
import { tvdConflictResolutions, tvdEvidence, tvdEvidenceIndependence, tvdEvidenceLinks, tvdFactClaims, tvdFactConflicts, tvdReviewTasks } from './schema-evidence';
import { tvdEnterpriseAliases, tvdEnterpriseProfiles, tvdEnterprises } from './schema-enterprise';
import { tvdBenchmarkMembers, tvdBenchmarkResults, tvdBenchmarkSets, tvdMatchResults, tvdProducts } from './schema-market';
import { tvdDataSources, tvdSignalSources, tvdSignals, tvdSourceLineage, tvdSourceRecords } from './schema-source';
import { tvdPatentAnomalies, tvdPatentInventors, tvdPatentQualityAssessments, tvdPatentStats, tvdPatents, tvdPeople } from './schema-patent';
import { tvdReportSections, tvdReports } from './schema-report';

export * from './core';
export * from './schema-enterprise';
export * from './schema-source';
export * from './schema-evidence';
export * from './schema-patent';
export * from './schema-domain';
export * from './schema-assessment';
export * from './schema-market';
export * from './schema-report';

export const tvdSchema = {
  tvdEnterprises,
  tvdEnterpriseAliases,
  tvdEnterpriseProfiles,

  tvdDataSources,
  tvdSourceRecords,
  tvdSourceLineage,
  tvdSignals,
  tvdSignalSources,

  tvdEvidence,
  tvdEvidenceLinks,
  tvdEvidenceIndependence,
  tvdFactClaims,
  tvdFactConflicts,
  tvdConflictResolutions,
  tvdReviewTasks,

  tvdPeople,
  tvdPatents,
  tvdPatentInventors,
  tvdPatentQualityAssessments,
  tvdPatentAnomalies,
  tvdPatentStats,

  tvdIndustryNodes,
  tvdIndustryEdges,
  tvdEnterpriseChainPositions,
  tvdTracks,

  tvdAssessmentModels,
  tvdAssessmentModelVersions,
  tvdAssessmentIndicators,
  tvdAssessmentRuns,
  tvdAssessmentScores,
  tvdScoreEvidenceLinks,

  tvdBenchmarkSets,
  tvdBenchmarkMembers,
  tvdBenchmarkResults,
  tvdProducts,
  tvdMatchResults,

  tvdReports,
  tvdReportSections,
};

/** 迁移与一致性校验用的表清单，顺序同上。 */
export const tvdTables = Object.values(tvdSchema);

export type TvdSchemaKey = keyof typeof tvdSchema;
