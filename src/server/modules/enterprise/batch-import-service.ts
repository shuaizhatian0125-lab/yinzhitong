import { createEnterprise, type EnterpriseCreateInput } from './enterprise-service';

export type BatchImportResult = {
  successCount: number;
  failureCount: number;
  failures: Array<{ index: number; name: string; reason: string }>;
};

type BatchEnterpriseInput = {
  name: string;
  unifiedCode?: string;
  industry?: string;
  scale?: string;
  region?: string;
  level?: string;
  riskLevel?: string;
  profile?: Record<string, unknown>;
  tags?: string[];
  isTech?: boolean;
};

export async function batchImport(
  tenantId: string,
  fileContent: string,
  format: 'json' = 'json',
): Promise<BatchImportResult> {
  let enterprises: BatchEnterpriseInput[];

  try {
    const parsed = JSON.parse(fileContent);
    if (Array.isArray(parsed)) {
      enterprises = parsed as BatchEnterpriseInput[];
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.enterprises)) {
      enterprises = parsed.enterprises as BatchEnterpriseInput[];
    } else {
      return {
        successCount: 0,
        failureCount: 1,
        failures: [{ index: 0, name: '', reason: 'JSON格式不正确：应为数组或包含enterprises字段的对象' }],
      };
    }
  } catch {
    return {
      successCount: 0,
      failureCount: 1,
      failures: [{ index: 0, name: '', reason: 'JSON解析失败' }],
    };
  }

  let successCount = 0;
  const failures: Array<{ index: number; name: string; reason: string }> = [];

  for (let i = 0; i < enterprises.length; i++) {
    const item = enterprises[i];
    if (!item.name || typeof item.name !== 'string') {
      failures.push({ index: i, name: item?.name ?? '', reason: '企业名称不能为空' });
      continue;
    }

    try {
      const input: EnterpriseCreateInput = {
        name: item.name,
        unifiedCode: item.unifiedCode,
        industry: item.industry,
        scale: item.scale,
        region: item.region,
        level: item.level,
        riskLevel: item.riskLevel,
        profile: item.profile,
        tags: item.tags,
      };

      await createEnterprise(tenantId, input);
      successCount++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : '创建失败';
      failures.push({ index: i, name: item.name, reason });
    }
  }

  return {
    successCount,
    failureCount: failures.length,
    failures,
  };
}