import { defineConfig } from 'vitest/config';

/**
 * 只跑纯逻辑测试：评分引擎、特征折算这类必须可复算的东西。
 * 数据库相关的验证仍走 scripts/ 下的脚本，因为 PGlite 是进程内单实例，
 * 与 dev server 抢同一个数据目录。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '.next/**'],
  },
});
