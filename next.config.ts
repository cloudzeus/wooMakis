import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required by the Dockerfile's runtime stage, which copies .next/standalone.
  output: 'standalone',

  // `next dev` otherwise regenerates AGENTS.md and CLAUDE.md at the repo root
  // on every start. They were deliberately removed in 2a987ae.
  agentRules: false,

  // Image uploads go through a server action; the 1 MB default rejects photos.
  experimental: {
    serverActions: { bodySizeLimit: '16mb' },
  },

  images: {
    remotePatterns: [
      // Mirrored product imagery (Bunny pull zone).
      { protocol: 'https', hostname: 'woomakis.b-cdn.net' },
      // Fallback for assets not yet mirrored — MediaAsset keeps the origin url.
      { protocol: 'https', hostname: 'www.mylens.gr' },
    ],
  },
}

export default nextConfig
