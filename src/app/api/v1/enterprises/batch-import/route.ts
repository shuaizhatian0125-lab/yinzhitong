import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { batchImport } from '@/server/modules/enterprise/batch-import-service';

const batchImportSchema = z.object({
  fileContent: z.string().min(1, '文件内容不能为空'),
  format: z.enum(['json']).default('json'),
});

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = batchImportSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const result = await batchImport(user.tenantId, parsed.data.fileContent, parsed.data.format);
    return jsonResponse(success(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : '批量导入失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}