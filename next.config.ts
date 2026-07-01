import type { NextConfig } from 'next'

const config: NextConfig = {
  // Strict mode catches double-render bugs in development
  reactStrictMode: true,

  // Allow Prisma + game-engine to stay server-side only
  serverExternalPackages: ['@prisma/client'],
}

export default config
