import type { NextConfig } from "next";
import { archivosRuntimeLegacy } from './scripts/legacy-runtime-files.mjs';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  outputFileTracingIncludes: {
    '/admin/migracion': [
      './scripts/migrar-legacy.mjs',
      './scripts/legacy-catalogos.mjs',
      './scripts/legacy-tablas.mjs',
      './scripts/postgres-config.mjs',
      './scripts/certs/supabase-prod-ca-2021.crt',
      ...archivosRuntimeLegacy(),
    ],
  },
};

export default nextConfig;
