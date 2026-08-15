import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `next dev` otherwise regenerates AGENTS.md and CLAUDE.md at the repo root
  // on every start. They were deliberately removed in 2a987ae.
  agentRules: false,
}

export default nextConfig
