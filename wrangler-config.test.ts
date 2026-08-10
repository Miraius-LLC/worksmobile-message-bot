import { describe, expect, test } from 'bun:test'
import { file, JSONC } from 'bun'

interface WranglerConfig {
  name?: string
  main?: string
  compatibility_date?: string
  compatibility_flags?: string[]
  routes?: unknown[]
}

describe('wrangler config', () => {
  test('Worker entry と Node compatibility を固定する', async () => {
    const source = await file(new URL('./wrangler.jsonc', import.meta.url)).text()
    const config = JSONC.parse(source) as WranglerConfig

    expect(config.name).toBe('worksmobile-message-bot')
    expect(config.main).toBe('src/worker.ts')
    expect(config.compatibility_date).toBe('2026-08-08')
    expect(config.compatibility_flags).toContain('nodejs_compat')
    expect(config.routes).toBeUndefined()
  })
})
