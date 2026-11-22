import { NextRequest } from 'next/server';
import { destroySession } from '@/lib/auth';
import { success, jsonResponse } from '@/lib/api-response';

export async function POST(_request: NextRequest): Promise<Response> {
  await destroySession();
  return jsonResponse(success(null, '已退出登录'));
}