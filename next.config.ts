import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),  // Uncomment and add 'import path from "path"' if needed
  /* config options here */

  /**
   * PGlite 是内嵌 Postgres：webpack 会把它的 pg_trgm 扩展包当静态资源发成
   * /_next/static/media/pg_trgm.tar.gz 并按 URL 取，服务端拿不到；
   * node:path 也被换成浏览器实现，fs 会收到 URL 实例。
   * 这两个包必须让 Node 自己 require，不参与打包。
   */
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'drizzle-orm/pglite'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
