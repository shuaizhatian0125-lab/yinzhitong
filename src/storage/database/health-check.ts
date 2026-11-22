import { isDemoMode } from '@/lib/config';

export type HealthCheckResult = {
  healthy: boolean;
  message: string;
  timestamp: string;
};

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();

  if (isDemoMode) {
    return {
      healthy: true,
      message: 'Demo mode active, database health check skipped',
      timestamp,
    };
  }

  const url = process.env.COZE_SUPABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    return {
      healthy: false,
      message: 'No database URL configured (COZE_SUPABASE_URL or DATABASE_URL required when DEMO_MODE=false)',
      timestamp,
    };
  }

  const hasKey = !!process.env.COZE_SUPABASE_ANON_KEY || !!process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
  if (!hasKey) {
    return {
      healthy: false,
      message: 'No Supabase key configured (COZE_SUPABASE_ANON_KEY or COZE_SUPABASE_SERVICE_ROLE_KEY required)',
      timestamp,
    };
  }

  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const client = getSupabaseClient();
    const { error } = await client.from('tenant').select('id').limit(1);
    if (error) {
      return {
        healthy: false,
        message: `Database query failed: ${error.message}`,
        timestamp,
      };
    }
    return {
      healthy: true,
      message: 'Database connection healthy',
      timestamp,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      healthy: false,
      message: `Database connection error: ${msg}`,
      timestamp,
    };
  }
}

export async function logDatabaseHealth(): Promise<void> {
  const result = await checkDatabaseHealth();
  if (result.healthy) {
    console.log(`[Database Health] ${result.message} (${result.timestamp})`);
  } else {
    console.error(`[Database Health] ${result.message} (${result.timestamp})`);
  }
}