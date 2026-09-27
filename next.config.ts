import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/admin/migracion': [
      './scripts/migrar-legacy.mjs',
      './node_modules/mysql2/**/*',
      './node_modules/pg/**/*',
    ],
  },
};

export default nextConfig;
