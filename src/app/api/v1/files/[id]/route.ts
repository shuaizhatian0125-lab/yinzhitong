import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getFileMetadata, getPresignedUrl, deleteFile } from '@/server/platform/file/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const download = sp.get('download');

  const metadata = await getFileMetadata(id, user.tenantId);
  if (!metadata) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '文件不存在'), 404);
  }

  if (download === '1') {
    const signedUrl = await getPresignedUrl(id, user.tenantId);
    if (!signedUrl) {
      return jsonResponse(error(ErrorCode.INTERNAL_ERROR, '生成下载链接失败'), 500);
    }
    return jsonResponse(success({ ...metadata, downloadUrl: signedUrl }));
  }

  return jsonResponse(success(metadata));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const deleted = await deleteFile(id, user.tenantId);

  if (!deleted) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '文件不存在'), 404);
  }

  return jsonResponse(success({ deleted: true }));
}