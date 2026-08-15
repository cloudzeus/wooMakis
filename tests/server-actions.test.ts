import { describe, it, expect } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * A "use server" module may only export async functions.
 *
 * TypeScript and the production build both accept a `export const FOO = {...}`
 * in one: the failure appears at runtime, on the page that imports it, as
 * `A "use server" file can only export async functions, found object`. That is
 * a crash in front of a user for something a grep can catch.
 *
 * Types are exempt — they are erased before the directive means anything.
 */
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(full)))
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

describe('"use server" modules', () => {
  it('export only async functions', async () => {
    const root = new URL('../src', import.meta.url).pathname
    const offenders: string[] = []

    for (const file of await walk(root)) {
      const src = await readFile(file, 'utf8')
      if (!/^\s*['"]use server['"]/m.test(src)) continue

      for (const [i, line] of src.split('\n').entries()) {
        // `export type` and `export interface` are erased; everything else
        // that is not an async function is a runtime error.
        if (/^export\s+(const|let|var|class|enum)\s/.test(line)) {
          offenders.push(`${file.replace(root, 'src')}:${i + 1} → ${line.trim().slice(0, 70)}`)
        }
        if (/^export\s+function\s/.test(line)) {
          offenders.push(`${file.replace(root, 'src')}:${i + 1} → not async: ${line.trim().slice(0, 60)}`)
        }
      }
    }

    expect(offenders, `invalid exports in "use server" files:\n${offenders.join('\n')}`).toEqual([])
  })
})
