import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getEnterprise, type EnterpriseRow, type EnterpriseProfile } from '@/server/modules/enterprise/enterprise-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

type AnalysisRow = {
  id: string;
  type: string;
  summary: string;
  scores: Record<string, unknown>;
  evidence: Array<{ finding: string; source: string; confidence: string }>;
  demands: Array<{ type: string; amountRange: string; urgency: string }>;
  report_content: Record<string, unknown>;
  created_at: string;
};

type InsightDataResponse = {
  enterprise: {
    id: string;
    name: string;
    industry: string;
    region: string;
    scale: string;
    riskLevel: string;
    profile: EnterpriseProfile;
  };
  analyses: Array<{
    type: string;
    scores: Record<string, unknown>;
    evidence: Array<{ finding: string; source: string; confidence: string }>;
    demands: Array<{ type: string; amountRange: string; urgency: string }>;
    reportContent: Record<string, unknown>;
    createdAt: string;
  }>;
  radarScores: {
    techInnovation: number;
    growthPotential: number;
    marketSpace: number;
    financialDemand: number;
    riskLevel: number;
  };
  trendData: {
    years: string[];
    revenueGrowth: number[];
    rdInvestment: number[];
    marketShare: number[];
  };
  industryAvg: {
    scale: number;
    tech: number;
    growth: number;
    risk: number;
  };
  enterpriseCompare: {
    scale: number;
    tech: number;
    growth: number;
    risk: number;
  };
  overallScore: number;
  valueLevel: string;
};

function ratingToScore(rating: string): number {
  const map: Record<string, number> = { A: 90, B: 75, C: 60, D: 45 };
  return map[rating?.toUpperCase()?.trim()] ?? 50;
}

function riskLevelToScore(riskLevel: string): number {
  const map: Record<string, number> = { low: 80, medium: 60, high: 40, unknown: 50 };
  return map[riskLevel] ?? 50;
}

function scaleToScore(scale: string): number {
  if (!scale || scale === '待补充') return 50;
  if (scale.includes('大型') || scale.includes('超大型')) return 85;
  if (scale.includes('中型')) return 65;
  if (scale.includes('小型') || scale.includes('微型')) return 40;
  return 50;
}

function estimateTechScore(scores: Record<string, unknown>): number {
  const rating = scores['innovation_rating'];
  if (typeof rating === 'string') return ratingToScore(rating);
  const coreTech = scores['core_tech'];
  if (typeof coreTech === 'string') {
  if (coreTech.includes('领先') || coreTech.includes('先进')) return 85;
  if (coreTech.includes('一般')) return 60;
  if (coreTech.includes('薄弱') || coreTech.includes('待补充')) return 40;
  }
  return 50;
}

function estimateGrowthScore(scores: Record<string, unknown>): number {
  const devStage = scores['dev_stage'];
  if (typeof devStage === 'string') {
  if (devStage.includes('成长')) return 80;
  if (devStage.includes('初创')) return 65;
  if (devStage.includes('成熟')) return 55;
  if (devStage.includes('转型')) return 45;
  }
  const growthMetrics = scores['growth_metrics'];
  if (typeof growthMetrics === 'string') {
  if (growthMetrics.includes('高速') || growthMetrics.includes('快速')) return 85;
  if (growthMetrics.includes('稳定')) return 65;
  if (growthMetrics.includes('缓慢') || growthMetrics.includes('下降')) return 40;
  }
  return 50;
}

function estimateMarketScore(scores: Record<string, unknown>): number {
  const marketSpace = scores['market_space'];
  if (typeof marketSpace === 'string') {
  if (marketSpace.includes('广阔') || marketSpace.includes('大')) return 85;
  if (marketSpace.includes('稳定') || marketSpace.includes('中等')) return 65;
  if (marketSpace.includes('小') || marketSpace.includes('饱和')) return 40;
  }
  return 50;
}

function estimateFinanceScore(demands: Array<{ type: string; urgency: string }>): number {
  if (demands.length === 0) return 30;
  const urgencyWeight: Record<string, number> = { high: 25, medium: 15, low: 8 };
  let score = 0;
  for (const d of demands) {
  score += urgencyWeight[d.urgency] ?? 10;
  }
  return Math.min(score, 100);
}

function extractTrendValue(text: string, keywords: string[]): number | null {
  if (!text || text === '待补充') return null;
  for (const kw of keywords) {
  if (text.includes(kw)) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) return parseFloat(match[1]);
  }
  }
  return null;
}

function estimateIndustryAvg(industry: string, scale: string): { scale: number; tech: number; growth: number; risk: number } {
  const baseAvg = { scale: 65, tech: 55, growth: 60, risk: 70 };
  if (!industry || industry === '待补充') return baseAvg;
  if (industry.includes('科技') || industry.includes('软件') || industry.includes('信息技术')) {
  return { scale: 55, tech: 70, growth: 75, risk: 65 };
  }
  if (industry.includes('制造') || industry.includes('工业')) {
  return { scale: 70, tech: 50, growth: 55, risk: 75 };
  }
  if (industry.includes('金融') || industry.includes('服务')) {
  return { scale: 75, tech: 45, growth: 50, risk: 80 };
  }
  if (industry.includes('医药') || industry.includes('生物')) {
  return { scale: 50, tech: 75, growth: 70, risk: 60 };
  }
  return baseAvg;
}

function calculateOverallScore(radar: InsightDataResponse['radarScores']): number {
  return Math.round(
  (radar.techInnovation + radar.growthPotential + radar.marketSpace + radar.financialDemand + radar.riskLevel) / 5
  );
}

function getValueLevel(score: number): string {
  if (score >= 80) return '高价值';
  if (score >= 60) return '中价值';
  if (score >= 40) return '低价值';
  return '待评估';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
  return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;

  const entResult = await getEnterprise(user.tenantId, id);
  if (!entResult) {
  return jsonResponse(error(ErrorCode.NOT_FOUND, '企业不存在'), 404);
  }

  const { row, profile } = entResult;

  const db = getSupabaseClient();
  const { data: analysisRows } = await db
  .from('enterprise_analysis')
  .select('*')
  .eq('tenant_id', user.tenantId)
  .eq('enterprise_id', id)
  .order('created_at', { ascending: false });

  const analyses = (analysisRows ?? []).map((r) => {
  const row = r as AnalysisRow;
  return {
  type: row.type,
  scores: row.scores ?? {},
  evidence: (row.evidence ?? []) as Array<{ finding: string; source: string; confidence: string }>,
  demands: (row.demands ?? []) as Array<{ type: string; amountRange: string; urgency: string }>,
  reportContent: row.report_content ?? {},
  createdAt: row.created_at,
  };
  });

  const techAnalysis = analyses.find((a) => a.type === 'tech_innovation');
  const growthAnalysis = analyses.find((a) => a.type === 'growth_potential');
  const financeAnalysis = analyses.find((a) => a.type === 'financial_demand');

  const radarScores = {
  techInnovation: techAnalysis ? estimateTechScore(techAnalysis.scores) : 50,
  growthPotential: growthAnalysis ? estimateGrowthScore(growthAnalysis.scores) : 50,
  marketSpace: growthAnalysis ? estimateMarketScore(growthAnalysis.scores) : 50,
  financialDemand: financeAnalysis ? estimateFinanceScore(financeAnalysis.demands) : 30,
  riskLevel: riskLevelToScore(row.risk_level),
  };

  const currentYear = new Date().getFullYear();
  const years = [String(currentYear - 3), String(currentYear - 2), String(currentYear - 1), String(currentYear)];

  const revBase = extractTrendValue(profile.businessStatus, ['营收', '收入', '增长']) ?? 15;
  const rdBase = extractTrendValue(profile.techAttributes, ['研发', '投入']) ?? 8;
  const shareBase = extractTrendValue(profile.marketSpace, ['份额', '占比']) ?? 5;

  const trendData = {
  years,
  revenueGrowth: [Math.max(revBase - 5, 0), Math.max(revBase - 2, 0), revBase, Math.min(revBase + 3, 50)],
  rdInvestment: [Math.max(rdBase - 3, 0), Math.max(rdBase - 1, 0), rdBase, Math.min(rdBase + 2, 30)],
  marketShare: [Math.max(shareBase - 2, 0), Math.max(shareBase - 1, 0), shareBase, Math.min(shareBase + 1.5, 20)],
  };

  const industryAvg = estimateIndustryAvg(profile.basicInfo.industry, profile.basicInfo.scale);

  const enterpriseCompare = {
  scale: scaleToScore(profile.basicInfo.scale),
  tech: radarScores.techInnovation,
  growth: radarScores.growthPotential,
  risk: radarScores.riskLevel,
  };

  const overallScore = calculateOverallScore(radarScores);
  const valueLevel = getValueLevel(overallScore);

  const responseData: InsightDataResponse = {
  enterprise: {
  id: row.id,
  name: row.name,
  industry: profile.basicInfo.industry,
  region: profile.basicInfo.region,
  scale: profile.basicInfo.scale,
  riskLevel: row.risk_level,
  profile,
  },
  analyses,
  radarScores,
  trendData,
  industryAvg,
  enterpriseCompare,
  overallScore,
  valueLevel,
  };

  return jsonResponse(success(responseData));
}