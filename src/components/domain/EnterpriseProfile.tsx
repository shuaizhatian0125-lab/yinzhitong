'use client';

import * as React from 'react';
import { Building2, Cpu, Package, TrendingUp, AlertTriangle, Link2, Users, DollarSign, Activity, MapPin, FileText, Shield } from 'lucide-react';

export type EnterpriseProfileData = {
  basicInfo: {
    name: string;
    unifiedCode: string;
    industry: string;
    scale: string;
    region: string;
    level: string;
    tags: string[];
  };
  industryStage: string;
  businessStatus: string;
  techAttributes: string;
  productCompetitiveness: string;
  growthPotential: string;
  marketSpace: string;
  financingStatus: string;
  enterpriseDynamics: string;
  riskAlerts: string;
  supplyChainPosition: string;
  competitors: string;
};

type EnterpriseProfileProps = {
  profile: EnterpriseProfileData;
  riskLevel: string;
};

const DIMENSIONS = [
  { key: 'industryStage', label: '行业发展阶段', icon: TrendingUp },
  { key: 'businessStatus', label: '经营状况', icon: Activity },
  { key: 'techAttributes', label: '技术属性', icon: Cpu },
  { key: 'productCompetitiveness', label: '产品竞争力', icon: Package },
  { key: 'growthPotential', label: '成长潜力', icon: TrendingUp },
  { key: 'marketSpace', label: '市场空间', icon: MapPin },
  { key: 'financingStatus', label: '融资情况', icon: DollarSign },
  { key: 'enterpriseDynamics', label: '企业动态', icon: FileText },
  { key: 'riskAlerts', label: '风险提示', icon: AlertTriangle },
  { key: 'supplyChainPosition', label: '产业链位置', icon: Link2 },
  { key: 'competitors', label: '竞争对手', icon: Users },
] as const;

const RISK_VARIANT: Record<string, string> = {
  low: 'bz-badge-ok',
  medium: 'bz-badge-warn',
  high: 'bz-badge-danger',
  unknown: 'bz-badge-gray',
};

const RISK_LABEL: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  unknown: '风险未知',
};

function isPending(value: string): boolean {
  return value === '待补充';
}

export function EnterpriseProfile({ profile, riskLevel }: EnterpriseProfileProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 基础信息卡片 */}
      <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">
            <Building2 className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
            企业基础信息
          </span>
          <span className={`bz-badge ${RISK_VARIANT[riskLevel] ?? 'bz-badge-gray'}`}>
            <Shield className="h-3 w-3" />
            {RISK_LABEL[riskLevel] ?? '风险未知'}
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-[12px] text-[var(--bz-text-muted)]">企业名称</span>
              <p className="text-[14px] font-medium text-[var(--bz-text)] mt-1">{profile.basicInfo.name}</p>
            </div>
            <div>
              <span className="text-[12px] text-[var(--bz-text-muted)]">统一社会信用代码</span>
              <p className={`text-[14px] mt-1 ${isPending(profile.basicInfo.unifiedCode) ? 'text-[var(--bz-text-muted)]' : 'text-[var(--bz-text)]'}`}>
                {profile.basicInfo.unifiedCode}
              </p>
            </div>
            <div>
              <span className="text-[12px] text-[var(--bz-text-muted)]">所属行业</span>
              <p className={`text-[14px] mt-1 ${isPending(profile.basicInfo.industry) ? 'text-[var(--bz-text-muted)]' : 'text-[var(--bz-text)]'}`}>
                {profile.basicInfo.industry}
              </p>
            </div>
            <div>
              <span className="text-[12px] text-[var(--bz-text-muted)]">企业规模</span>
              <p className={`text-[14px] mt-1 ${isPending(profile.basicInfo.scale) ? 'text-[var(--bz-text-muted)]' : 'text-[var(--bz-text)]'}`}>
                {profile.basicInfo.scale}
              </p>
            </div>
            <div>
              <span className="text-[12px] text-[var(--bz-text-muted)]">所在区域</span>
              <p className={`text-[14px] mt-1 ${isPending(profile.basicInfo.region) ? 'text-[var(--bz-text-muted)]' : 'text-[var(--bz-text)]'}`}>
                {profile.basicInfo.region}
              </p>
            </div>
            <div>
              <span className="text-[12px] text-[var(--bz-text-muted)]">企业等级</span>
              <p className={`text-[14px] mt-1 ${isPending(profile.basicInfo.level) ? 'text-[var(--bz-text-muted)]' : 'text-[var(--bz-text)]'}`}>
                {profile.basicInfo.level}
              </p>
            </div>
          </div>
          {profile.basicInfo.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.basicInfo.tags.map((tag) => (
                <span key={tag} className="bz-badge bz-badge-blue">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 12维度画像 */}
      <div className="grid grid-cols-2 gap-3">
        {DIMENSIONS.map((dim) => {
          const Icon = dim.icon;
          const value = profile[dim.key];
          const pending = isPending(value);
          return (
            <div key={dim.key} className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <Icon className="h-4 w-4 shrink-0" style={{ color: pending ? 'var(--bz-text-muted)' : 'var(--bz-brand)' }} />
                <span className="text-[13px] font-medium text-[var(--bz-text)]">{dim.label}</span>
              </div>
              <div className="px-4 pb-3">
                <p className={`text-[13px] leading-relaxed ${pending ? 'text-[var(--bz-text-muted)] italic' : 'text-[var(--bz-text-sub)]'}`}>
                  {value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}