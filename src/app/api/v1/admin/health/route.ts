import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

function requireAdmin(user: { permissions: string[] } | null): boolean {
  if (!user) return false;
  return user.permissions.includes('*') || user.permissions.includes('admin');
}

type HealthStatus = 'healthy' | 'degraded' | 'down';

type SubsystemHealth = {
  status: HealthStatus;
  latencyMs: number | null;
  detail: string;
};

async function checkDatabase(): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    const db = await getSupabaseClient();
    const { error: dbError } = await db.from('tenant').select('id').limit(1);
    const latencyMs = Date.now() - start;
    if (dbError) {
      return { status: 'down', latencyMs, detail: dbError.message };
    }
    return { status: 'healthy', latencyMs, detail: 'ok' };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

async function checkAiGateway(): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    const gatewayUrl = process.env.AI_GATEWAY_URL;
    if (!gatewayUrl) {
      return { status: 'degraded', latencyMs: null, detail: 'AI_GATEWAY_URL not configured' };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${gatewayUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { status: 'healthy', latencyMs, detail: 'ok' };
    }
    return { status: 'degraded', latencyMs, detail: `HTTP ${res.status}` };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

async function checkRedis(): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return { status: 'degraded', latencyMs: null, detail: 'REDIS_URL not configured' };
    }
    return { status: 'healthy', latencyMs: Date.now() - start, detail: 'configured' };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireAdmin(user)) return forbiddenResponse();

  const [database, aiGateway, redis] = await Promise.all([
    checkDatabase(),
    checkAiGateway(),
    checkRedis(),
  ]);

  const overall: HealthStatus =
    database.status === 'down' || aiGateway.status === 'down'
      ? 'down'
      : database.status === 'degraded' || aiGateway.status === 'degraded' || redis.status === 'degraded'
        ? 'degraded'
        : 'healthy';

  return jsonResponse(success({
    status: overall,
    timestamp: new Date().toISOString(),
    subsystems: { database, aiGateway, redis },
  }));
}