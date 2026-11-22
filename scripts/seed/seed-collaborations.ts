import type { SeedResult } from './seed-all';

export async function seedCollaborations(tenantId: string): Promise<SeedResult> {
  console.log(`[Seed] collaborations: tenant=${tenantId}`);
  return { module: 'collaborations', successCount: 0, failureCount: 0, failures: [] };
}