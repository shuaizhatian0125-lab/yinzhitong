import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

function getCredentials() {
  const url = process.env.COZE_SUPABASE_URL || process.env.DATABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('COZE_SUPABASE_URL or DATABASE_URL is not set');
  }
  if (!anonKey && !serviceRoleKey) {
    throw new Error('Supabase keys are not set');
  }

  return { url, anonKey, serviceRoleKey };
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey, serviceRoleKey } = getCredentials();

  let key: string;
  if (token) {
    key = anonKey!;
  } else {
    key = serviceRoleKey ?? anonKey!;
  }

  const globalOptions: {
    headers?: { Authorization: string };
  } = {};

  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }

  if (!clientInstance || token) {
    return createClient(url, key, {
      global: globalOptions,
      db: { timeout: 60000 },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return clientInstance;
}

function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}

export async function checkDatabaseHealth(): Promise<{ healthy: boolean; message: string }> {
  const isDemo = process.env.DEMO_MODE === 'true';
  if (isDemo) {
    return { healthy: true, message: 'Demo mode active, database health check skipped' };
  }

  const url = process.env.COZE_SUPABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    return { healthy: false, message: 'No database URL configured (COZE_SUPABASE_URL or DATABASE_URL)' };
  }

  const hasKey = !!process.env.COZE_SUPABASE_ANON_KEY || !!process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
  if (!hasKey) {
    return { healthy: false, message: 'No Supabase key configured (COZE_SUPABASE_ANON_KEY or COZE_SUPABASE_SERVICE_ROLE_KEY)' };
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client.from('tenant').select('id').limit(1);
    if (error) {
      return { healthy: false, message: `Database query failed: ${error.message}` };
    }
    return { healthy: true, message: 'Database connection healthy' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { healthy: false, message: `Database connection error: ${msg}` };
  }
}

export { getSupabaseClient, getSupabaseServiceRoleKey };
