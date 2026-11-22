#!/usr/bin/env tsx
/**
 * 五维评分跑批入口。
 *
 *   pnpm tvd:score                  跑全部企业
 *   pnpm tvd:score --limit 10       只跑前 10 家（按企业名排序，取样稳定）
 *   pnpm tvd:score --id <uuid>      只跑一家
 *   pnpm tvd:score --check          只读：看库里已落地的评分分布，不写
 *
 * 评分是确定性代码执行的（PRD 红线），因此这个脚本不读任何模型输出，
 * 也不写 ai_interpretation —— 那一列只能由报告侧单独填。
 */
import { getTvdDb } from '../src/storage/database/tvd/client';
import { TVD_DEMO_SCOPE } from '../src/server/modules/tvd-data/scope';
import { listScopeEnterpriseIds, runAssessment } from '../src/server/modules/tvd-data/scoring/assessment';
import { RULE_VERSION } from '../src/server/modules/tvd-data/scoring/rules';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main(): Promise<void> {
  const handle = await getTvdDb();
  try {
    if (process.argv[2] === '--check' || process.argv[2] === 'check') {
      const rows = await handle.query<{
        runs: string;
        scored: string;
        withheld: string;
        avg_score: string | null;
        avg_coverage: string | null;
      }>(
        `select count(*)::text as runs,
                count(*) filter (where total_score is not null)::text as scored,
                count(*) filter (where total_score is null)::text as withheld,
                avg(total_score)::text as avg_score,
                avg(data_coverage)::text as avg_coverage
           from tvd_assessment_runs`,
      );
      console.log(`[tvd] 规则版本 ${RULE_VERSION} 已落地评分：`, rows[0]);
      const grades = await handle.query<{ grade: string | null; n: string }>(
        `select grade, count(*)::text as n from tvd_assessment_runs group by grade order by grade`,
      );
      console.table(grades);
      return;
    }

    const onlyId = arg('id');
    const limit = arg('limit') ? Number(arg('limit')) : undefined;
    const targets = onlyId
      ? [{ id: onlyId, name: onlyId }]
      : await listScopeEnterpriseIds(handle, TVD_DEMO_SCOPE);
    const picked = limit ? targets.slice(0, limit) : targets;

    console.log(`[tvd] 规则 ${RULE_VERSION}，本次评分 ${picked.length} 家企业（后端 ${handle.kind}）`);
    const t0 = Date.now();
    const out: Record<string, string | number | null>[] = [];
    let failed = 0;
    let withheld = 0;

    for (const e of picked) {
      try {
        const r = await runAssessment(TVD_DEMO_SCOPE, e.id, handle);
        if (!r) {
          failed += 1;
          console.log(`  跳过 ${e.name}：作用域内查不到该企业`);
          continue;
        }
        if (r.totalScore === null) withheld += 1;
        out.push({
          企业: r.enterpriseName,
          总分: r.totalScore === null ? '证据不足' : r.totalScore.toFixed(2),
          分级: r.grade ?? '—',
          覆盖率: `${(r.dataCoverage * 100).toFixed(1)}%`,
          置信度: `${(r.evidenceConfidence * 100).toFixed(1)}%`,
          分项: r.scoreRows,
          证据链接: r.evidenceLinks,
        });
      } catch (err) {
        failed += 1;
        console.error(`  失败 ${e.name}：`, err instanceof Error ? err.message : err);
      }
    }

    console.table(out.slice(0, 15));
    const scored = out.filter((r) => typeof r.总分 === 'string' && r.总分 !== '证据不足');
    const avg =
      scored.length > 0
        ? scored.reduce((n, r) => n + Number(r.总分), 0) / scored.length
        : null;
    console.log(
      `[tvd] 完成 ${out.length} 家（出分 ${scored.length}、暂缓 ${withheld}、失败 ${failed}），` +
        `均分 ${avg === null ? '—' : avg.toFixed(2)}，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
    console.log('[tvd] 暂缓的原因写在 tvd_assessment_runs.score_withheld_reason，不是 0 分。');
  } finally {
    // PGlite 会挂住事件循环，不 close 进程不退出。
    await handle.close();
  }
}

main().catch((err) => {
  console.error('[tvd] 评分失败：', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
