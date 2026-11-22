import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { uploadFile } from '@/server/platform/file/service';

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '未提供文件'), 400);
  }

  const sensitivity = (formData.get('sensitivity') as string) ?? 'internal';
  const bucket = (formData.get('bucket') as string) ?? undefined;

  try {
    const content = await file.arrayBuffer();
    const record = await uploadFile({
      tenantId: user.tenantId,
      filename: file.name,
      mime: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      content,
      ownerId: user.id,
      sensitivity,
      bucket,
    });

    return jsonResponse(success(record), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '文件上传失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}