export type Permission = {
  code: string;
  name: string;
  module: string;
};

export type DataScope =
  | 'self'
  | 'assigned'
  | 'participated'
  | 'team'
  | 'org'
  | 'org_tree'
  | 'custom'
  | 'all';

/* ============================================================
 * 权限码常量 — 便于 IDE 自动补全与重构安全
 * ============================================================ */

export const PERM = {
  // workbench
  WORKBENCH_VIEW: 'workbench.view',
  // task
  TASK_VIEW: 'task.view',
  TASK_CREATE: 'task.create',
  TASK_EDIT: 'task.edit',
  TASK_DELETE: 'task.delete',
  TASK_ASSIGN: 'task.assign',
  TASK_EXECUTE: 'task.execute',
  TASK_MANAGE: 'task.manage',
  // collab
  COLLAB_VIEW: 'collab.view',
  COLLAB_CREATE: 'collab.create',
  COLLAB_EDIT: 'collab.edit',
  COLLAB_DELETE: 'collab.delete',
  // office
  OFFICE_VIEW: 'office.view',
  OFFICE_CREATE: 'office.create',
  OFFICE_EDIT: 'office.edit',
  OFFICE_DELETE: 'office.delete',
  OFFICE_EXPORT: 'office.export',
  // research
  RESEARCH_VIEW: 'research.view',
  RESEARCH_CREATE: 'research.create',
  RESEARCH_EDIT: 'research.edit',
  RESEARCH_DELETE: 'research.delete',
  RESEARCH_EXECUTE: 'research.execute',
  // enterprise
  ENTERPRISE_VIEW: 'enterprise.view',
  ENTERPRISE_CREATE: 'enterprise.create',
  ENTERPRISE_EDIT: 'enterprise.edit',
  ENTERPRISE_DELETE: 'enterprise.delete',
  ENTERPRISE_EXECUTE: 'enterprise.execute',
  // customer
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_EDIT: 'customer.edit',
  CUSTOMER_DELETE: 'customer.delete',
  CUSTOMER_EXECUTE: 'customer.execute',
  // marketing
  MARKETING_VIEW: 'marketing.view',
  MARKETING_CREATE: 'marketing.create',
  MARKETING_EDIT: 'marketing.edit',
  MARKETING_DELETE: 'marketing.delete',
  MARKETING_EXECUTE: 'marketing.execute',
  // risk
  RISK_VIEW: 'risk.view',
  RISK_CREATE: 'risk.create',
  RISK_EDIT: 'risk.edit',
  RISK_DELETE: 'risk.delete',
  RISK_EXECUTE: 'risk.execute',
  // analytics
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_CREATE: 'analytics.create',
  ANALYTICS_EDIT: 'analytics.edit',
  ANALYTICS_DELETE: 'analytics.delete',
  ANALYTICS_EXPORT: 'analytics.export',
  // knowledge
  KNOWLEDGE_VIEW: 'knowledge.view',
  KNOWLEDGE_CREATE: 'knowledge.create',
  KNOWLEDGE_EDIT: 'knowledge.edit',
  KNOWLEDGE_DELETE: 'knowledge.delete',
  KNOWLEDGE_GRANT: 'knowledge.grant',
  // cockpit
  COCKPIT_VIEW: 'cockpit.view',
  COCKPIT_EXECUTE: 'cockpit.execute',
  // ai
  AI_VIEW: 'ai.view',
  AI_EXECUTE: 'ai.execute',
  AI_MANAGE: 'ai.manage',
  // document
  DOCUMENT_VIEW: 'document.view',
  DOCUMENT_CREATE: 'document.create',
  DOCUMENT_EDIT: 'document.edit',
  DOCUMENT_DELETE: 'document.delete',
  DOCUMENT_EXPORT: 'document.export',
  DOCUMENT_SHARE: 'document.share',
  // admin
  ADMIN_USER_VIEW: 'admin.user.view',
  ADMIN_USER_MANAGE: 'admin.user.manage',
  ADMIN_ROLE_VIEW: 'admin.role.view',
  ADMIN_ROLE_MANAGE: 'admin.role.manage',
  ADMIN_MODULE_VIEW: 'admin.module.view',
  ADMIN_MODULE_MANAGE: 'admin.module.manage',
  ADMIN_AUDIT_VIEW: 'admin.audit.view',
  ADMIN_AUDIT_EXPORT: 'admin.audit.export',
  ADMIN_CONFIG_VIEW: 'admin.config.view',
  ADMIN_CONFIG_MANAGE: 'admin.config.manage',
  // system
  SYSTEM_VIEW: 'system.view',
  SYSTEM_MANAGE: 'system.manage',
} as const;

/** S1 权限目录（后端强制校验，前端仅用于隐藏入口） */
export const PERMISSIONS: Permission[] = [
  // workbench
  { code: PERM.WORKBENCH_VIEW, name: '访问 AI 工作台', module: 'workbench' },
  // task
  { code: PERM.TASK_VIEW, name: '查看任务', module: 'task' },
  { code: PERM.TASK_CREATE, name: '创建任务', module: 'task' },
  { code: PERM.TASK_EDIT, name: '编辑任务', module: 'task' },
  { code: PERM.TASK_DELETE, name: '删除任务', module: 'task' },
  { code: PERM.TASK_ASSIGN, name: '指派任务', module: 'task' },
  { code: PERM.TASK_EXECUTE, name: '执行任务', module: 'task' },
  { code: PERM.TASK_MANAGE, name: '管理任务', module: 'task' },
  // collab
  { code: PERM.COLLAB_VIEW, name: '查看协作', module: 'collab' },
  { code: PERM.COLLAB_CREATE, name: '创建协作', module: 'collab' },
  { code: PERM.COLLAB_EDIT, name: '编辑协作', module: 'collab' },
  { code: PERM.COLLAB_DELETE, name: '删除协作', module: 'collab' },
  // office
  { code: PERM.OFFICE_VIEW, name: '查看文档办公', module: 'office' },
  { code: PERM.OFFICE_CREATE, name: '创建文档', module: 'office' },
  { code: PERM.OFFICE_EDIT, name: '编辑文档', module: 'office' },
  { code: PERM.OFFICE_DELETE, name: '删除文档', module: 'office' },
  { code: PERM.OFFICE_EXPORT, name: '导出文档', module: 'office' },
  // research
  { code: PERM.RESEARCH_VIEW, name: '查看行业研究', module: 'research' },
  { code: PERM.RESEARCH_CREATE, name: '创建研究报告', module: 'research' },
  { code: PERM.RESEARCH_EDIT, name: '编辑研究报告', module: 'research' },
  { code: PERM.RESEARCH_DELETE, name: '删除研究报告', module: 'research' },
  { code: PERM.RESEARCH_EXECUTE, name: '执行行业分析', module: 'research' },
  // enterprise
  { code: PERM.ENTERPRISE_VIEW, name: '查看企业金融', module: 'enterprise' },
  { code: PERM.ENTERPRISE_CREATE, name: '创建企业档案', module: 'enterprise' },
  { code: PERM.ENTERPRISE_EDIT, name: '编辑企业档案', module: 'enterprise' },
  { code: PERM.ENTERPRISE_DELETE, name: '删除企业档案', module: 'enterprise' },
  { code: PERM.ENTERPRISE_EXECUTE, name: '执行企业分析', module: 'enterprise' },
  // customer
  { code: PERM.CUSTOMER_VIEW, name: '查看客户经营', module: 'customer' },
  { code: PERM.CUSTOMER_CREATE, name: '创建客户', module: 'customer' },
  { code: PERM.CUSTOMER_EDIT, name: '编辑客户', module: 'customer' },
  { code: PERM.CUSTOMER_DELETE, name: '删除客户', module: 'customer' },
  { code: PERM.CUSTOMER_EXECUTE, name: '执行客户分析', module: 'customer' },
  // marketing
  { code: PERM.MARKETING_VIEW, name: '查看营销', module: 'marketing' },
  { code: PERM.MARKETING_CREATE, name: '创建营销活动', module: 'marketing' },
  { code: PERM.MARKETING_EDIT, name: '编辑营销活动', module: 'marketing' },
  { code: PERM.MARKETING_DELETE, name: '删除营销活动', module: 'marketing' },
  { code: PERM.MARKETING_EXECUTE, name: '执行营销分析', module: 'marketing' },
  // risk
  { code: PERM.RISK_VIEW, name: '查看风险合规', module: 'risk' },
  { code: PERM.RISK_CREATE, name: '创建风险规则', module: 'risk' },
  { code: PERM.RISK_EDIT, name: '编辑风险规则', module: 'risk' },
  { code: PERM.RISK_DELETE, name: '删除风险规则', module: 'risk' },
  { code: PERM.RISK_EXECUTE, name: '执行风险处置', module: 'risk' },
  // analytics
  { code: PERM.ANALYTICS_VIEW, name: '查看经营分析', module: 'analytics' },
  { code: PERM.ANALYTICS_CREATE, name: '创建分析看板', module: 'analytics' },
  { code: PERM.ANALYTICS_EDIT, name: '编辑分析看板', module: 'analytics' },
  { code: PERM.ANALYTICS_DELETE, name: '删除分析看板', module: 'analytics' },
  { code: PERM.ANALYTICS_EXPORT, name: '导出分析数据', module: 'analytics' },
  // knowledge
  { code: PERM.KNOWLEDGE_VIEW, name: '查看知识库', module: 'knowledge' },
  { code: PERM.KNOWLEDGE_CREATE, name: '创建知识库', module: 'knowledge' },
  { code: PERM.KNOWLEDGE_EDIT, name: '编辑知识库', module: 'knowledge' },
  { code: PERM.KNOWLEDGE_DELETE, name: '删除知识库', module: 'knowledge' },
  { code: PERM.KNOWLEDGE_GRANT, name: '授权知识库', module: 'knowledge' },
  // cockpit
  { code: PERM.COCKPIT_VIEW, name: '查看管理驾驶舱', module: 'cockpit' },
  { code: PERM.COCKPIT_EXECUTE, name: '执行驾驶舱操作', module: 'cockpit' },
  // ai
  { code: PERM.AI_VIEW, name: '查看 AI 配置', module: 'ai' },
  { code: PERM.AI_EXECUTE, name: '执行 AI 调用', module: 'ai' },
  { code: PERM.AI_MANAGE, name: '管理 AI 配置', module: 'ai' },
  // document
  { code: PERM.DOCUMENT_VIEW, name: '查看文档', module: 'document' },
  { code: PERM.DOCUMENT_CREATE, name: '创建文档', module: 'document' },
  { code: PERM.DOCUMENT_EDIT, name: '编辑文档', module: 'document' },
  { code: PERM.DOCUMENT_DELETE, name: '删除文档', module: 'document' },
  { code: PERM.DOCUMENT_EXPORT, name: '导出文档', module: 'document' },
  { code: PERM.DOCUMENT_SHARE, name: '分享文档', module: 'document' },
  // admin
  { code: PERM.ADMIN_USER_VIEW, name: '查看用户与组织', module: 'admin' },
  { code: PERM.ADMIN_USER_MANAGE, name: '维护用户与组织', module: 'admin' },
  { code: PERM.ADMIN_ROLE_VIEW, name: '查看角色权限', module: 'admin' },
  { code: PERM.ADMIN_ROLE_MANAGE, name: '维护角色权限', module: 'admin' },
  { code: PERM.ADMIN_MODULE_VIEW, name: '查看模块配置', module: 'admin' },
  { code: PERM.ADMIN_MODULE_MANAGE, name: '维护模块配置', module: 'admin' },
  { code: PERM.ADMIN_AUDIT_VIEW, name: '查看审计日志', module: 'admin' },
  { code: PERM.ADMIN_AUDIT_EXPORT, name: '导出审计日志', module: 'admin' },
  { code: PERM.ADMIN_CONFIG_VIEW, name: '查看系统配置', module: 'admin' },
  { code: PERM.ADMIN_CONFIG_MANAGE, name: '维护系统配置', module: 'admin' },
  // system
  { code: PERM.SYSTEM_VIEW, name: '查看系统信息', module: 'system' },
  { code: PERM.SYSTEM_MANAGE, name: '管理系统', module: 'system' },
];

export type RolePreset = {
  code: string;
  name: string;
  description: string;
  dataScope: DataScope;
  permissions: string[];
};

/* ---------- 角色权限集 ---------- */

const STAFF_PERMS = [
  PERM.WORKBENCH_VIEW,
  PERM.TASK_VIEW,
  PERM.TASK_CREATE,
  PERM.TASK_EDIT,
  PERM.TASK_EXECUTE,
  PERM.ENTERPRISE_VIEW,
  PERM.CUSTOMER_VIEW,
  PERM.MARKETING_VIEW,
  PERM.KNOWLEDGE_VIEW,
  PERM.DOCUMENT_VIEW,
  PERM.DOCUMENT_CREATE,
  PERM.RESEARCH_VIEW,
];

const TEAM_LEAD_PERMS = [
  ...STAFF_PERMS,
  PERM.TASK_ASSIGN,
  PERM.COLLAB_VIEW,
  PERM.COLLAB_CREATE,
  PERM.COCKPIT_VIEW,
  PERM.ANALYTICS_VIEW,
  PERM.MARKETING_EXECUTE,
];

const DEPT_HEAD_PERMS = [
  ...TEAM_LEAD_PERMS,
  PERM.TASK_MANAGE,
  PERM.RISK_VIEW,
  PERM.DOCUMENT_EXPORT,
  PERM.MARKETING_CREATE,
  PERM.MARKETING_EDIT,
];

const ALL_VIEW_PERMS = PERMISSIONS.filter((p) => p.code.endsWith('.view')).map((p) => p.code);

const AUDITOR_PERMS = [
  PERM.SYSTEM_VIEW,
  PERM.ADMIN_AUDIT_VIEW,
  PERM.ADMIN_AUDIT_EXPORT,
  ...ALL_VIEW_PERMS,
];

const ADMIN_PERMS = PERMISSIONS.map((p) => p.code);

export const ROLE_PRESETS: RolePreset[] = [
  {
    code: 'staff',
    name: '客户经理',
    description: '一线业务岗：使用工作台、承接与执行任务、访问已授权业务中心',
    dataScope: 'self',
    permissions: STAFF_PERMS,
  },
  {
    code: 'team_lead',
    name: '团队负责人',
    description: '团队管理岗：团队任务分派与进度跟踪、查看团队数据',
    dataScope: 'team',
    permissions: TEAM_LEAD_PERMS,
  },
  {
    code: 'dept_head',
    name: '部门负责人',
    description: '部门管理岗：部门级数据范围、任务管理、风险查看、文档导出',
    dataScope: 'org_tree',
    permissions: DEPT_HEAD_PERMS,
  },
  {
    code: 'admin',
    name: '系统管理员',
    description: '平台管理岗：用户、组织、角色、审计、模块、配置全量管理权限',
    dataScope: 'all',
    permissions: ADMIN_PERMS,
  },
  {
    code: 'auditor',
    name: '审计合规岗',
    description: '只读审计岗：可查询全量操作留痕与导出，不可修改业务数据',
    dataScope: 'all',
    permissions: AUDITOR_PERMS,
  },
];

export type CenterDef = {
  code: string;
  name: string;
  short: string;
  group: string;
  stage: 'S2' | 'S3' | 'S4' | 'S5';
  summary: string;
  capabilities: string[];
  href: string;
};

/** 12 大工作中心（模块注册表的前端投影） */
export const CENTERS: CenterDef[] = [
  {
    code: 'workbench',
    name: 'AI 工作台',
    short: '工作台',
    group: '核心',
    stage: 'S2',
    summary: '统一入口：自然语言发起任务、承接待办、查看 AI 产出与待确认事项',
    capabilities: ['指令台', '我的待办', 'AI 产出', '待确认动作'],
    href: '/workbench',
  },
  {
    code: 'task',
    name: '任务与日程中心',
    short: '任务',
    group: '核心',
    stage: 'S2',
    summary: '任务全生命周期管理：创建、分派、流转、留痕、与日程联动',
    capabilities: ['任务看板', '状态流转', '责任人分派', '日程视图'],
    href: '/work/tasks',
  },
  {
    code: 'collab',
    name: '协作中心',
    short: '协作',
    group: '核心',
    stage: 'S3',
    summary: '跨部门项目、议题跟踪、审批流转与会议纪要归集',
    capabilities: ['项目空间', '审批流', '会议纪要'],
    href: '/collaborations',
  },
  {
    code: 'office',
    name: '文档办公中心',
    short: '文档',
    group: '生产',
    stage: 'S3',
    summary: '行内格式模板驱动的公文、报告、方案生成与版本管理',
    capabilities: ['模板库', 'AI 起草', '版本对比', '引用溯源'],
    href: '/centers/office',
  },
  {
    code: 'knowledge',
    name: '知识中心',
    short: '知识',
    group: '生产',
    stage: 'S3',
    summary: '制度、产品、案例知识库，检索增强问答，按权限分级授权',
    capabilities: ['知识库', '混合检索', '引用问答', '授权管理'],
    href: '/centers/knowledge',
  },
  {
    code: 'research',
    name: '行业研究中心',
    short: '行业',
    group: '经营',
    stage: 'S4',
    summary: '行业画像、政策跟踪、同业对比与产业链机会识别',
    capabilities: ['行业画像', '政策跟踪', '同业对比'],
    href: '/centers/research',
  },
  {
    code: 'enterprise',
    name: '企业金融中心',
    short: '企业',
    group: '经营',
    stage: 'S4',
    summary: '企业客户全景、价值挖掘、授信与产品匹配建议',
    capabilities: ['企业全景', '价值评估', '产品匹配'],
    href: '/centers/enterprise',
  },
  {
    code: 'customer',
    name: '客户经营中心',
    short: '客户',
    group: '经营',
    stage: 'S4',
    summary: '客户分层、拜访计划、商机推进与关系图谱',
    capabilities: ['客户 360', '拜访计划', '商机漏斗'],
    href: '/centers/customer',
  },
  {
    code: 'marketing',
    name: '营销中心',
    short: '营销',
    group: '经营',
    stage: 'S5',
    summary: '客群圈选、活动策划、内容生成与效果归因',
    capabilities: ['客群圈选', '活动策划', '效果归因'],
    href: '/centers/marketing',
  },
  {
    code: 'risk',
    name: '风险合规中心',
    short: '风险',
    group: '管控',
    stage: 'S5',
    summary: '风险规则、预警处置、合规检查与整改闭环',
    capabilities: ['规则配置', '预警处置', '合规检查'],
    href: '/centers/risk',
  },
  {
    code: 'analytics',
    name: '经营分析中心',
    short: '分析',
    group: '管控',
    stage: 'S5',
    summary: '指标口径统一、多维分析、异常归因与自助取数',
    capabilities: ['指标中心', '多维分析', '归因报告'],
    href: '/centers/analytics',
  },
  {
    code: 'cockpit',
    name: '管理驾驶舱',
    short: '驾驶舱',
    group: '管控',
    stage: 'S5',
    summary: '面向管理层的经营全景、重点工作督办与风险总览',
    capabilities: ['经营全景', '重点督办', '风险总览'],
    href: '/centers/cockpit',
  },
];
