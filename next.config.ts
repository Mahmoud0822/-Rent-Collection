import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  experimental: { cpus: 2 },
}
export default nextConfig
