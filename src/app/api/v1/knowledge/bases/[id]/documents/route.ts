import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { uploadDocument } from '@/server/modules/knowledge/knowledge-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id: kbId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return jsonResponse(error(ErrorCode.BAD_REQUEST, '未提供文件'), 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const doc = await uploadDocument(user.tenantId, user.id, kbId, {
      name: file.name,
      buffer,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    });

    return jsonResponse(success(doc), 201);
  } catch (err) {
    return jsonResponse(
      error(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : '上传文档失败'),
      500,
    );
  }
}