import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `next dev` otherwise regenerates AGENTS.md and CLAUDE.md at the repo root
  // on every start. They were deliberately removed in 2a987ae.
  agentRules: false,

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
