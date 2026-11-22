'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Plus, Search, BookOpen, Users,
  ClipboardCheck, Shield, Target, Lightbulb,
  TrendingUp, AlertCircle, Beaker,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type TemplateItem = {
  id: string;
  name: string;
  type: string;
  description: string;
  participantCount: number;
  workstreamCount: number;
  estimatedDuration: string;
  icon: React.ReactNode;
  color: string;
};

const TEMPLATES: TemplateItem[] = [
  {
    id: 'research',
    name: '研究协作',
    type: 'research',
    description: '多人协作完成行业研究、市场分析等研究类任务',
    participantCount: 4,
    workstreamCount: 3,
    estimatedDuration: '2-4周',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'var(--bz-brand)',
  },
  {
    id: 'project',
    name: '项目协作',
    type: 'project',
    description: '标准项目管理协作，包含计划、执行、监控全流程',
    participantCount: 6,
    workstreamCount: 5,
    estimatedDuration: '4-8周',
    icon: <Target className="h-5 w-5" />,
    color: 'var(--bz-info)',
  },
  {
    id: 'cross_dept',
    name: '跨部门协作',
    type: 'cross_dept',
    description: '跨部门数据协同与流程打通',
    participantCount: 8,
    workstreamCount: 4,
    estimatedDuration: '2-6周',
    icon: <Users className="h-5 w-5" />,
    color: 'var(--bz-gold)',
  },
  {
    id: 'customer',
    name: '客户协作',
    type: 'customer',
    description: '客户服务与关系管理的协作流程',
    participantCount: 5,
    workstreamCount: 3,
    estimatedDuration: '1-3周',
    icon: <ClipboardCheck className="h-5 w-5" />,
    color: 'var(--bz-ok)',
  },
  {
    id: 'compliance',
    name: '合规协作',
    type: 'compliance',
    description: '合规审查与风险控制的协作流程',
    participantCount: 4,
    workstreamCount: 3,
    estimatedDuration: '2-4周',
    icon: <Shield className="h-5 w-5" />,
    color: 'var(--bz-danger)',
  },
  {
    id: 'strategic_planning',
    name: '战略规划协作',
    type: 'strategic_planning',
    description: '战略目标制定与规划分解的协作流程',
    participantCount: 6,
    workstreamCount: 4,
    estimatedDuration: '4-8周',
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'var(--bz-brand)',
  },
  {
    id: 'risk_assessment',
    name: '风险评估协作',
    type: 'risk_assessment',
    description: '风险识别、评估与应对的协作流程',
    participantCount: 5,
    workstreamCount: 3,
    estimatedDuration: '1-3周',
    icon: <AlertCircle className="h-5 w-5" />,
    color: 'var(--bz-warn)',
  },
  {
    id: 'knowledge_building',
    name: '知识沉淀协作',
    type: 'knowledge_building',
    description: '团队知识整理与沉淀的协作流程',
    participantCount: 4,
    workstreamCount: 2,
    estimatedDuration: '2-4周',
    icon: <Lightbulb className="h-5 w-5" />,
    color: 'var(--bz-info)',
  },
  {
    id: 'innovation',
    name: '创新孵化协作',
    type: 'innovation',
    description: '新产品/新业务创新孵化的协作流程',
    participantCount: 6,
    workstreamCount: 4,
    estimatedDuration: '6-12周',
    icon: <Beaker className="h-5 w-5" />,
    color: 'var(--bz-gold)',
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [keyword, setKeyword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const filteredTemplates = keyword
    ? TEMPLATES.filter((t) => t.name.includes(keyword) || t.description.includes(keyword))
    : TEMPLATES;

  const handleCreateFromTemplate = (template: TemplateItem) => {
    router.push(`/collaborations/create?template=${template.type}&title=${encodeURIComponent(template.name)}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="协作模板库"
        description="9种预置模板，从模板快速创建协作"
        actions={
          <button
            className="bz-btn bz-btn-primary"
            style={{ borderRadius: 3 }}
            onClick={() => router.push('/collaborations/create')}
          >
            <Plus className="h-4 w-4" />
            自定义创建
          </button>
        }
      />

      <div className="flex items-center gap-1">
        <Search className="h-3.5 w-3.5 text-[var(--bz-text-muted)]" />
        <input
          type="text"
          placeholder="搜索模板..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="text-[13px] px-3 py-1.5 rounded border flex-1"
          style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="bz-card cursor-pointer transition-colors hover:border-[var(--bz-brand)]"
            style={{ borderRadius: 6, padding: '14px' }}
            onClick={() => handleCreateFromTemplate(template)}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded"
                style={{ background: `${template.color}15`, borderRadius: 2 }}
              >
                <span style={{ color: template.color }}>{template.icon}</span>
              </div>
              <span className="text-[14px] font-medium text-[var(--bz-text)]">{template.name}</span>
            </div>

            <p className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed mb-3">{template.description}</p>

            <div className="flex items-center gap-3 text-[11px] text-[var(--bz-text-muted)]">
              <span className="flex items-center gap-0.5">
                <Users className="h-3 w-3" />
                {template.participantCount}人
              </span>
              <span className="flex items-center gap-0.5">
                <Target className="h-3 w-3" />
                {template.workstreamCount}工作线
              </span>
              <span>{template.estimatedDuration}</span>
            </div>

            <button
              className="w-full mt-3 text-[12px] py-1.5 rounded"
              style={{ borderRadius: 2, background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)' }}
            >
              从模板创建
            </button>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center text-[var(--bz-text-muted)] py-12">
          未找到匹配的模板
        </div>
      )}
    </div>
  );
}