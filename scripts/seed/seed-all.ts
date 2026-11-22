export type SeedResult = {
  module: string;
  successCount: number;
  failureCount: number;
  failures: Array<{ rowIndex: number; reason: string }>;
};

export async function seedAll(tenantId: string): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  const { seedIndustries } = await import('./seed-industries');
  const { seedEnterprises } = await import('./seed-enterprises');
  const { seedCustomers } = await import('./seed-customers');
  const { seedBankProducts } = await import('./seed-bank-products');
  const { seedCollaborations } = await import('./seed-collaborations');

  const modules = [
    { name: 'industries', fn: () => seedIndustries(tenantId) },
    { name: 'enterprises', fn: () => seedEnterprises(tenantId) },
    { name: 'customers', fn: () => seedCustomers(tenantId) },
    { name: 'bank-products', fn: () => seedBankProducts(tenantId) },
    { name: 'collaborations', fn: () => seedCollaborations(tenantId) },
  ];

  for (const mod of modules) {
    try {
      console.log(`[Seed] Starting ${mod.name}...`);
      const result = await mod.fn();
      results.push(result);
      console.log(`[Seed] ${mod.name}: success=${result.successCount}, failure=${result.failureCount}`);
    } catch (err) {
      console.error(`[Seed] ${mod.name} failed:`, err);
      results.push({
        module: mod.name,
        successCount: 0,
        failureCount: 1,
        failures: [{ rowIndex: 0, reason: String(err) }],
      });
    }
  }

  console.log('[Seed] All modules completed.');
  console.log(
    '[Seed] Summary:',
    results.map((r) => `${r.module}=${r.successCount}/${r.successCount + r.failureCount}`).join(', '),
  );

  return results;
}

const TENANT_ID = 'tenant-001';

seedAll(TENANT_ID)
  .then(() => {
    console.log('[Seed] Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Seed] Fatal error:', err);
    process.exit(1);
  });