import { describe, expect, test } from 'bun:test'

interface WranglerRoute {
  pattern?: string
  custom_domain?: boolean
}

interface WranglerConfig {
  name?: string
  main?: string
  compatibility_date?: string
  compatibility_flags?: string[]
  routes?: WranglerRoute[]
}

describe('wrangler config', () => {
  test('Worker entry と Node compatibility を固定する', async () => {
    const source = await Bun.file(new URL('./wrangler.jsonc', import.meta.url)).text()
    const config = Bun.JSONC.parse(source) as WranglerConfig

    expect(config.name).toBe('worksmobile-message-bot')
    expect(config.main).toBe('src/worker.ts')
    expect(config.compatibility_date).toBe('2026-08-08')
    expect(config.compatibility_flags).toContain('nodejs_compat')
    expect(config.routes).toEqual([
      {
        pattern: 'line-works.api.miraius.co.jp',
        custom_domain: true,
      },
    ])
  })
})
