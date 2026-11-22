import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getConversation, deleteConversation } from '@/server/modules/workbench/conversation-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const conversation = await getConversation(user, id);
  if (!conversation) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '会话不存在'), 404);
  }

  return jsonResponse(success(conversation));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const conversation = await getConversation(user, id);
  if (!conversation) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '会话不存在'), 404);
  }

  await deleteConversation(user, id);
  return jsonResponse(success({ deleted: true }));
}