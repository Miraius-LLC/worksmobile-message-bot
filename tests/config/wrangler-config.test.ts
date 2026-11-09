import { describe, expect, test } from 'bun:test'
import { file, JSONC } from 'bun'
import { createProductionConfig } from '../../scripts/create-wrangler-production-config'

interface WranglerConfig {
  name?: string
  main?: string
  compatibility_date?: string
  compatibility_flags?: string[]
  routes?: unknown[]
}

describe('wrangler config', () => {
  test('Worker entry と Node compatibility を固定する', async () => {
    const source = await file(new URL('../../.config/wrangler.jsonc', import.meta.url)).text()
    const config = JSONC.parse(source) as WranglerConfig

    expect(config.name).toBe('worksmobile-message-bot')
    expect(config.main).toBe('../src/worker.ts')
    expect((config as WranglerConfig & { $schema?: string }).$schema).toBe(
      '../node_modules/wrangler/config-schema.json',
    )
    expect(config.compatibility_date).toBe('2026-08-08')
    expect(config.compatibility_flags).toContain('nodejs_compat')
    expect(config.routes).toBeUndefined()
  })

  test('ルートに生成する本番設定はルート基準のentryとschemaを使う', async () => {
    const source = await file(new URL('../../.config/wrangler.jsonc', import.meta.url)).text()
    const config = JSON.parse(
      createProductionConfig(source, 'bot.example.com'),
    ) as WranglerConfig & {
      $schema?: string
    }

    expect(config.main).toBe('src/worker.ts')
    expect(config.$schema).toBe('node_modules/wrangler/config-schema.json')
    expect(config.routes).toEqual([{ pattern: 'bot.example.com', custom_domain: true }])
  })
})
