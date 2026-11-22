import { z } from 'zod';

const envSchema = z.object({
  APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  APP_SECRET_KEY: z.string().min(16, 'APP_SECRET_KEY must be at least 16 characters').default('dev-secret-key-change-in-production-32chars'),

  DATABASE_URL: z.string().optional(),

  COZE_SUPABASE_URL: z.string().optional(),
  COZE_SUPABASE_ANON_KEY: z.string().optional(),
  COZE_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  REDIS_URL: z.string().optional(),

  AI_DEFAULT_PROVIDER: z.string().default('openai_compatible'),
  AI_DEFAULT_MODEL: z.string().default('gpt-4o-mini'),
  AI_PROVIDER_OPENAI_BASE_URL: z.string().optional(),
  AI_PROVIDER_OPENAI_API_KEY: z.string().optional(),
  AI_FALLBACK_CHAIN: z.string().default('primary,backup'),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  WECHAT_APPID: z.string().optional(),
  WECHAT_SECRET: z.string().optional(),

  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(604800),

  FEATURE_MODULES: z.string().default('workbench,task,collab,office,knowledge,enterprise,research,customer,analytics,cockpit,risk,marketing'),
  DEMO_MODE: z.coerce.boolean().default(true),
}).superRefine((data, ctx) => {
  if (!data.DEMO_MODE) {
    const hasDbUrl = !!data.DATABASE_URL;
    const hasSupabaseUrl = !!data.COZE_SUPABASE_URL;
    const hasSupabaseKey = !!data.COZE_SUPABASE_ANON_KEY || !!data.COZE_SUPABASE_SERVICE_ROLE_KEY;

    if (!hasDbUrl && !hasSupabaseUrl) {
      ctx.addIssue({
        code: 'custom',
        message: 'When DEMO_MODE=false, DATABASE_URL or COZE_SUPABASE_URL must be configured',
        path: ['DEMO_MODE'],
      });
    }

    if (hasSupabaseUrl && !hasSupabaseKey) {
      ctx.addIssue({
        code: 'custom',
        message: 'When DEMO_MODE=false and using Supabase, COZE_SUPABASE_ANON_KEY or COZE_SUPABASE_SERVICE_ROLE_KEY must be configured',
        path: ['COZE_SUPABASE_URL'],
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;

export const isDev = env.APP_ENV === 'dev';
export const isProd = env.APP_ENV === 'prod';
export const isDemoMode = env.DEMO_MODE;

export const enabledModules = env.FEATURE_MODULES.split(',').map(m => m.trim());

export const aiConfig = {
  defaultProvider: env.AI_DEFAULT_PROVIDER,
  defaultModel: env.AI_DEFAULT_MODEL,
  baseUrl: env.AI_PROVIDER_OPENAI_BASE_URL,
  apiKey: env.AI_PROVIDER_OPENAI_API_KEY,
  fallbackChain: env.AI_FALLBACK_CHAIN.split(',').map(p => p.trim()),
};

export function logAiConfigStatus(): void {
  console.log('[AI Config] Configuration status:');
  console.log(`  provider: ${aiConfig.defaultProvider}`);
  console.log(`  model: ${aiConfig.defaultModel}`);
  console.log(`  baseUrl: ${aiConfig.baseUrl ? 'configured' : 'not configured'}`);
  console.log(`  apiKey: ${aiConfig.apiKey ? 'configured' : 'not configured'}`);
  console.log(`  demoMode: ${isDemoMode}`);
}

export const jwtConfig = {
  accessTtl: env.JWT_ACCESS_TTL,
  refreshTtl: env.JWT_REFRESH_TTL,
  secret: env.APP_SECRET_KEY,
};

export const dbConfig = {
  url: env.DATABASE_URL,
  supabaseUrl: env.COZE_SUPABASE_URL,
  supabaseAnonKey: env.COZE_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: env.COZE_SUPABASE_SERVICE_ROLE_KEY,
};

export const storageConfig = {
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
};

export const wechatConfig = {
  appid: env.WECHAT_APPID,
  secret: env.WECHAT_SECRET,
};
export function checkDatabaseRequired(): void {
  if (isDemoMode) return;

  const hasDbUrl = !!env.DATABASE_URL;
  const hasSupabaseUrl = !!env.COZE_SUPABASE_URL;
  const hasSupabaseKey = !!env.COZE_SUPABASE_ANON_KEY || !!env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!hasDbUrl && !hasSupabaseUrl) {
    throw new Error(
      '[Database] DEMO_MODE=false but no database configured. ' +
      'Please set DATABASE_URL or COZE_SUPABASE_URL in .env',
    );
  }

  if (hasSupabaseUrl && !hasSupabaseKey) {
    throw new Error(
      '[Database] COZE_SUPABASE_URL is set but no Supabase key configured. ' +
      'Please set COZE_SUPABASE_ANON_KEY or COZE_SUPABASE_SERVICE_ROLE_KEY in .env',
    );
  }

  console.log('[Database] Database configuration validated successfully');
}