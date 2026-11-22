#!/usr/bin/env tsx
/**
 * TVD-05 / TVD-06 专利质量与异常跑批入口。
 *
 *   pnpm tvd:patent-qc                跑全部企业
 *   pnpm tvd:patent-qc --limit 10     只跑前 10 家（按企业名排序，取样稳定）
 *   pnpm tvd:patent-qc --id <uuid>    只跑一家
 *   pnpm tvd:patent-qc --check        只读：看库里已落地的质量行与异常分布，不写
 *
 * 与五维评分同一条红线：全部由确定性代码算，AI 不参与打分，也不写异常定性。
 * 注意 dev server 运行时会独占 PGlite 数据目录，跑批要先停 dev 或改用 API。
 */
import { getTvdDb } from '../src/storage/database/tvd/client';
import { TVD_DEMO_SCOPE } from '../src/server/modules/tvd-data/scope';
import { listScopeEnterpriseIds } from '../src/server/modules/tvd-data/scoring/assessment';
import { recomputePatentQc } from '../src/server/modules/tvd-data/patent-qc/store';
import { PQC_RULE_VERSION } from '../src/server/modules/tvd-data/patent-qc/rules';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main(): Promise<void> {
  const handle = await getTvdDb();
  try {
    if (process.argv[2] === '--check' || process.argv[2] === 'check') {
      const q = await handle.query<{ rows: string; patents: string; avg_score: string | null }>(
        `select count(*)::text as rows,
                count(distinct patent_id)::text as patents,
                avg(total_score)::text as avg_score
           from tvd_patent_quality_assessments where rule_version = $1`,
        [PQC_RULE_VERSION],
      );
      console.log(`[tvd] 质量行（${PQC_RULE_VERSION}）：`, q[0]);
      const grades = await handle.query<{ grade: string | null; n: string }>(
        `select grade, count(*)::text as n from tvd_patent_quality_assessments
          where rule_version = $1 group by grade order by grade`,
        [PQC_RULE_VERSION],
      );
      console.table(grades);
      const a = await handle.query<{ anomaly_type: string; severity: string; n: string }>(
        `select anomaly_type, severity, count(*)::text as n from tvd_patent_anomalies
          where rule_version = $1 group by anomaly_type, severity
          order by anomaly_type, severity`,
        [PQC_RULE_VERSION],
      );
      console.table(a);
      const stats = await handle.query<{ n: string; with_score: string; with_anomaly: string }>(
        `select count(*)::text as n,
                count(avg_quality_score)::text as with_score,
                count(*) filter (where anomaly_count > 0)::text as with_anomaly
           from tvd_patent_stats where rule_version = 'v1'`,
      );
      console.log('[tvd] 统计回填情况（有质量分 / 有异常的企行数）：', stats[0]);
      return;
    }

    const onlyId = arg('id');
    const limit = arg('limit') ? Number(arg('limit')) : undefined;
    const targets = onlyId ? [{ id: onlyId, name: onlyId }] : await listScopeEnterpriseIds(handle, TVD_DEMO_SCOPE);
    const picked = limit ? targets.slice(0, limit) : targets;

    console.log(`[tvd] 规则 ${PQC_RULE_VERSION}，本次评估 ${picked.length} 家企业的专利（后端 ${handle.kind}）`);
    const t0 = Date.now();
    const out: Record<string, string | number | null>[] = [];
    let failed = 0;
    let anomalies = 0;

    for (const e of picked) {
      try {
        const r = await recomputePatentQc(TVD_DEMO_SCOPE, e.id, handle);
        if (!r) {
          failed += 1;
          console.log(`  跳过 ${e.name}：作用域内查不到该企业`);
          continue;
        }
        anomalies += r.anomalyRows;
        out.push({
          企业: r.enterpriseName,
          专利: r.patents,
          出分: r.scored,
          均分: r.avgQualityScore === null ? '缺输入' : r.avgQualityScore.toFixed(2),
          异常: r.anomalyRows,
          类型: Object.entries(r.anomalyByType)
            .map(([k, v]) => `${k}×${v}`)
            .join(' ') || '—',
        });
      } catch (err) {
        failed += 1;
        console.error(`  失败 ${e.name}：`, err instanceof Error ? err.message : err);
      }
    }

    console.table(out.slice(0, 15));
    console.log(
      `[tvd] 完成 ${out.length} 家（异常合计 ${anomalies} 条、失败 ${failed}），耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
    console.log('[tvd] 异常是"需要核实的问题"，判定权在人工复核队列，不在这里。');
  } finally {
    // PGlite 会挂住事件循环，不 close 进程不退出。
    await handle.close();
  }
}

main().catch((err) => {
  console.error('[tvd] 专利质量评估失败：', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
