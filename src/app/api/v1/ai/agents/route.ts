import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getAvailableAgents } from '@/server/ai/runtime/intent-router';

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const agents = getAvailableAgents(user);
  return jsonResponse(success({ items: agents }));
}