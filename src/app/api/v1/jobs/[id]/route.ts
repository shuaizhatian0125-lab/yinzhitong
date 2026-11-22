import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getJobStatus } from '@/server/platform/job/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const job = await getJobStatus(id, user.tenantId);

  if (!job) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '任务不存在'), 404);
  }

  return jsonResponse(success(job));
}