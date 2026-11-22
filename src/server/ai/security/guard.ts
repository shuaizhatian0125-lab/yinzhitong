import type { SessionUser } from '@/lib/auth';
import type { Plan, LegacyPlan } from '@/server/ai/runtime/planner';
import type { RunBudget } from '@/server/ai/runtime/executor';

export type SecurityCheckPoint =
  | 'INPUT'
  | 'PLAN'
  | 'TOOL'
  | 'DATA'
  | 'OUTPUT'
  | 'PUBLISH';

export type SecurityCheckResult = {
  passed: boolean;
  checkpoint: SecurityCheckPoint;
  violations: SecurityViolation[];
  timestamp: string;
};

export type SecurityViolation = {
  code: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detail?: string;
};

export type ProhibitedBehavior =
  | 'SELF_ELEVATE_PERMISSION'
  | 'ACCESS_UNAUTHORIZED_DATA'
  | 'BYPASS_APPROVAL'
  | 'MODIFY_SYSTEM_CONFIG'
  | 'DELETE_CRITICAL_DATA'
  | 'DISABLE_SECURITY_CHECK'
  | 'LEAK_SENSITIVE_INFO'
  | 'EXECUTE_UNREGISTERED_TOOL'
  | 'FORGE_AUDIT_RECORD';

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(above|previous|prior)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all|any|previous)\s+(instructions?|rules?|guidelines?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /forget\s+(everything|all|previous)/i,
  /override\s+(system|safety|security)\s+(prompt|instructions?|rules?)/i,
  /reveal\s+(system|internal|hidden)\s+(prompt|instructions?|config)/i,
  /act\s+as\s+(if\s+you\s+are|a)\s+/i,
  /\[SYSTEM\]|\[ADMIN\]|\[ROOT\]/i,
];

const SENSITIVE_DATA_PATTERNS = [
  /\b\d{16,19}\b/,
  /\b\d{6}\s?\d{4}\s?\d{4}\s?\d{4}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  /身份证|护照|银行卡|信用卡|密码|口令|secret|password|token|api[_-]?key/i,
];

const CONFIG_TOOL_CODES = ['system_config_update', 'env_update', 'permission_update'];
const DELETE_TOOL_CODES = ['delete_record', 'delete_data', 'remove_entity'];

let securityGuardEnabled = true;

export function isSecurityGuardEnabled(): boolean {
  return securityGuardEnabled;
}

export function setSecurityGuardEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new Error('Security Guard 不可被禁用');
  }
  securityGuardEnabled = enabled;
}

export async function checkInput(
  userInput: string,
  user: SessionUser,
): Promise<SecurityCheckResult> {
  const violations: SecurityViolation[] = [];

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(userInput)) {
      violations.push({
        code: 'PROMPT_INJECTION',
        message: '检测到 Prompt Injection 尝试',
        severity: 'HIGH',
        detail: `匹配模式: ${pattern.source}`,
      });
    }
  }

  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    if (pattern.test(userInput)) {
      violations.push({
        code: 'SENSITIVE_DATA_INPUT',
        message: '输入中包含敏感信息',
        severity: 'MEDIUM',
        detail: `匹配模式: ${pattern.source}`,
      });
    }
  }

  if (userInput.trim().length === 0) {
    violations.push({
      code: 'EMPTY_INPUT',
      message: '输入内容为空',
      severity: 'LOW',
    });
  }

  return {
    passed: violations.length === 0,
    checkpoint: 'INPUT',
    violations,
    timestamp: new Date().toISOString(),
  };
}

export async function checkPlan(
  plan: Plan | LegacyPlan,
  user: SessionUser,
  budget?: RunBudget,
): Promise<SecurityCheckResult> {
  const violations: SecurityViolation[] = [];

  for (const step of plan.steps) {
    if (step.seq < 1) {
      violations.push({
        code: 'INVALID_STEP_SEQ',
        message: `步骤 ${step.seq} 序号无效`,
        severity: 'MEDIUM',
      });
    }

    if ('toolCode' in step && step.toolCode) {
      if (CONFIG_TOOL_CODES.includes(step.toolCode) && user.roleCode !== 'admin') {
        violations.push({
          code: 'PROHIBITED_SELF_ELEVATE',
          message: `步骤 ${step.seq} 尝试修改系统配置，需 ADMIN 权限`,
          severity: 'HIGH',
        });
      }

      if (DELETE_TOOL_CODES.includes(step.toolCode)) {
        violations.push({
          code: 'PROHIBITED_DELETE_CRITICAL',
          message: `步骤 ${step.seq} 尝试删除关键数据，需确认`,
          severity: 'HIGH',
        });
      }
    }

    if ('riskLevel' in step && step.riskLevel === 'L4' && user.roleCode === 'staff') {
      violations.push({
        code: 'RISK_LEVEL_EXCEEDED',
        message: `步骤 ${step.seq} 风险等级 L4 超出当前用户权限`,
        severity: 'HIGH',
      });
    }
  }

  if (budget) {
    if (budget.maxSteps && budget.maxSteps > 50) {
      violations.push({
        code: 'BUDGET_STEPS_UNREASONABLE',
        message: `maxSteps=${budget.maxSteps} 超出合理范围`,
        severity: 'MEDIUM',
      });
    }
    if (budget.maxTokens && budget.maxTokens > 500_000) {
      violations.push({
        code: 'BUDGET_TOKENS_UNREASONABLE',
        message: `maxTokens=${budget.maxTokens} 超出合理范围`,
        severity: 'MEDIUM',
      });
    }
  }

  return {
    passed: violations.length === 0,
    checkpoint: 'PLAN',
    violations,
    timestamp: new Date().toISOString(),
  };
}

export async function checkTool(
  toolCode: string,
  toolParams: Record<string, unknown>,
  user: SessionUser,
  isApproved: boolean,
): Promise<SecurityCheckResult> {
  const violations: SecurityViolation[] = [];

  if (!toolCode || toolCode.trim().length === 0) {
    violations.push({
      code: 'EMPTY_TOOL_CODE',
      message: '工具编码为空',
      severity: 'HIGH',
    });
  }

  if (CONFIG_TOOL_CODES.includes(toolCode) && user.roleCode !== 'admin') {
    violations.push({
      code: 'PROHIBITED_CONFIG_MODIFY',
      message: '修改系统配置需 ADMIN 角色',
      severity: 'CRITICAL',
    });
  }

  if (DELETE_TOOL_CODES.includes(toolCode) && !isApproved) {
    violations.push({
      code: 'PROHIBITED_DELETE_WITHOUT_APPROVAL',
      message: '删除关键数据需审批',
      severity: 'CRITICAL',
    });
  }

  if (toolParams && Object.keys(toolParams).length === 0) {
    violations.push({
      code: 'EMPTY_TOOL_PARAMS',
      message: '工具参数为空',
      severity: 'LOW',
    });
  }

  return {
    passed: violations.length === 0,
    checkpoint: 'TOOL',
    violations,
    timestamp: new Date().toISOString(),
  };
}

export async function checkData(
  operation: 'READ' | 'WRITE' | 'DELETE',
  dataScope: string,
  user: SessionUser,
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted' = 'internal',
): Promise<SecurityCheckResult> {
  const violations: SecurityViolation[] = [];

  if (sensitivity === 'restricted' && user.roleCode !== 'admin') {
    violations.push({
      code: 'PROHIBITED_ACCESS_RESTRICTED',
      message: '访问受限数据需 ADMIN 角色',
      severity: 'CRITICAL',
    });
  }

  if (sensitivity === 'confidential' && user.roleCode === 'staff' && user.dataScope === 'self') {
    violations.push({
      code: 'PROHIBITED_ACCESS_CONFIDENTIAL',
      message: '访问机密数据超出数据范围',
      severity: 'HIGH',
    });
  }

  if (operation === 'DELETE' && sensitivity !== 'public') {
    violations.push({
      code: 'DELETE_NON_PUBLIC_DATA',
      message: '删除非公开数据需确认',
      severity: 'HIGH',
    });
  }

  return {
    passed: violations.length === 0,
    checkpoint: 'DATA',
    violations,
    timestamp: new Date().toISOString(),
  };
}

export async function checkOutput(
  output: string,
  user: SessionUser,
): Promise<SecurityCheckResult> {
  const violations: SecurityViolation[] = [];

  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    if (pattern.test(output)) {
      violations.push({
        code: 'SENSITIVE_DATA_LEAK',
        message: '输出中包含敏感信息',
        severity: 'HIGH',
        detail: `匹配模式: ${pattern.source}`,
      });
    }
  }

  if (/system\s+prompt|internal\s+instructions?|hidden\s+rules?/i.test(output)) {
    violations.push({
      code: 'INTERNAL_PROMPT_LEAK',
      message: '输出中包含内部 Prompt 信息',
      severity: 'HIGH',
    });
  }

  if (output.length > 10_000 && !output.includes('\n')) {
    violations.push({
      code: 'FORMAT_NON_COMPLIANT',
      message: '输出格式不合规（过长且无换行）',
      severity: 'LOW',
    });
  }

  return {
    passed: violations.length === 0,
    checkpoint: 'OUTPUT',
    violations,
    timestamp: new Date().toISOString(),
  };
}

export async function checkPublish(
  content: string,
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED',
  user: SessionUser,
): Promise<SecurityCheckResult> {
  const violations: SecurityViolation[] = [];

  if (approvalStatus !== 'APPROVED') {
    violations.push({
      code: 'PUBLISH_WITHOUT_APPROVAL',
      message: '内容未经审批不可发布',
      severity: 'CRITICAL',
    });
  }

  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    if (pattern.test(content)) {
      violations.push({
        code: 'PUBLISH_SENSITIVE_DATA',
        message: '发布内容包含敏感信息',
        severity: 'CRITICAL',
      });
    }
  }

  return {
    passed: violations.length === 0,
    checkpoint: 'PUBLISH',
    violations,
    timestamp: new Date().toISOString(),
  };
}

export function checkProhibitedBehavior(
  behavior: ProhibitedBehavior,
  context: {
    user: SessionUser;
    requestedPermission?: string;
    dataScope?: string;
    approvalStatus?: string;
    toolCode?: string;
    isRegistered?: boolean;
  },
): SecurityViolation | null {
  switch (behavior) {
    case 'SELF_ELEVATE_PERMISSION':
      if (context.requestedPermission && context.user.permissions) {
        const hasPermission = context.user.permissions.includes(context.requestedPermission) ||
          context.user.permissions.includes('*');
        if (!hasPermission) {
          return {
            code: 'PROHIBITED_SELF_ELEVATE',
            message: 'AI 不得自行提升权限',
            severity: 'CRITICAL',
            detail: `请求权限 ${context.requestedPermission} 超出当前权限范围`,
          };
        }
      }
      break;

    case 'ACCESS_UNAUTHORIZED_DATA':
      if (context.dataScope && context.user.dataScope) {
        const userScopes = context.user.dataScope.split(',');
        if (!userScopes.includes(context.dataScope) && !userScopes.includes('*')) {
          return {
            code: 'PROHIBITED_UNAUTHORIZED_DATA',
            message: 'AI 不得访问越权数据',
            severity: 'HIGH',
            detail: `数据范围 ${context.dataScope} 超出用户范围 ${context.user.dataScope}`,
          };
        }
      }
      break;

    case 'BYPASS_APPROVAL':
      if (context.approvalStatus && context.approvalStatus !== 'APPROVED') {
        return {
          code: 'PROHIBITED_BYPASS_APPROVAL',
          message: 'AI 不得绕过审批流程',
          severity: 'HIGH',
          detail: `审批状态为 ${context.approvalStatus}，非 APPROVED`,
        };
      }
      break;

    case 'MODIFY_SYSTEM_CONFIG':
      if (context.toolCode && CONFIG_TOOL_CODES.includes(context.toolCode) && context.user.roleCode !== 'admin') {
        return {
          code: 'PROHIBITED_CONFIG_MODIFY',
          message: 'AI 不得修改系统配置',
          severity: 'CRITICAL',
        };
      }
      break;

    case 'DELETE_CRITICAL_DATA':
      if (context.toolCode && DELETE_TOOL_CODES.includes(context.toolCode)) {
        return {
          code: 'PROHIBITED_DELETE_CRITICAL',
          message: 'AI 不得删除关键数据',
          severity: 'CRITICAL',
        };
      }
      break;

    case 'DISABLE_SECURITY_CHECK':
      return {
        code: 'PROHIBITED_DISABLE_SECURITY',
        message: 'AI 不得自行关闭安全检查',
        severity: 'CRITICAL',
      };

    case 'LEAK_SENSITIVE_INFO':
      return null;

    case 'EXECUTE_UNREGISTERED_TOOL':
      if (context.isRegistered === false) {
        return {
          code: 'PROHIBITED_UNREGISTERED_TOOL',
          message: 'AI 不得执行未注册工具',
          severity: 'HIGH',
        };
      }
      break;

    case 'FORGE_AUDIT_RECORD':
      return {
        code: 'PROHIBITED_FORGE_AUDIT',
        message: 'AI 不得伪造审计记录',
        severity: 'CRITICAL',
      };
  }

  return null;
}

export function maskSensitiveData(text: string): string {
  let masked = text;
  masked = masked.replace(/\b\d{16,19}\b/g, '****');
  masked = masked.replace(/\b\d{6}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '**** **** **** ****');
  masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '****@****.***');
  masked = masked.replace(/身份证|护照|银行卡|信用卡|密码|口令|secret|password|token|api[_-]?key/gi, '****');
  return masked;
}