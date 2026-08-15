import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'

/**
 * The settings screen reads environment variables by name to report what is
 * configured. Those names are duplicated from the modules that actually use
 * them, and they drifted once: the screen looked for BUNNY_PULL_ZONE and
 * BUNNY_ACCESS_KEY while lib/bunny.ts uses BUNNY_PULL_ZONE_URL and
 * BUNNY_STORAGE_PASSWORD, so a working integration was reported as missing.
 */
describe('settings env names', () => {
  async function envNames(path: string): Promise<Set<string>> {
    const src = await readFile(new URL(path, import.meta.url), 'utf8')
    return new Set([...src.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(m => m[1]))
  }

  it('only names variables the code actually reads', async () => {
    const settings = await envNames('../src/app/(admin)/settings/page.tsx')
    const used = new Set([
      ...(await envNames('../src/lib/bunny.ts')),
      ...(await envNames('../src/lib/woo/write.ts')),
      ...(await envNames('../src/lib/woo/orders.ts')),
      ...(await envNames('../src/lib/deepseek.ts')),
    ])

    for (const name of settings) {
      if (!name.startsWith('BUNNY_') && !name.startsWith('DEEPSEEK_')) continue
      expect(used, `settings reports ${name}, which nothing reads`).toContain(name)
    }
  })
})
