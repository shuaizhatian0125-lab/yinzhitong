import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { confirmRun } from '@/server/ai/runtime/executor';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const result = await confirmRun(id, user);

  if (result.status === 'failed') {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, result.error ?? '确认失败'), 400);
  }

  return jsonResponse(success(result));
}