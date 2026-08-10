import { describe, expect, test } from 'bun:test'

interface WranglerConfig {
  name?: string
  main?: string
  compatibility_flags?: string[]
}

describe('wrangler config', () => {
  test('Worker entry と Node compatibility を固定する', async () => {
    const source = await Bun.file(new URL('./wrangler.jsonc', import.meta.url)).text()
    const config = Bun.JSONC.parse(source) as WranglerConfig

    expect(config.name).toBe('worksmobile-message-bot')
    expect(config.main).toBe('src/worker.ts')
    expect(config.compatibility_flags).toContain('nodejs_compat')
  })
})
