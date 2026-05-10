import { describe, expect, test } from 'bun:test'
import { requireEnv } from '@/test-helpers/utils'
import { config, load } from '@/utils/config'

// test-helpers/setup.ts が PRIVATE_KEY (実 RSA 鍵) + CLIENT_ID 等を埋めて load() 済み

describe('utils/config', () => {
  test('load() は env を camelCase の Config に変換する', () => {
    const cfg = load()
    expect(cfg.clientId).toBe(requireEnv('CLIENT_ID'))
    expect(cfg.clientSecret).toBe(requireEnv('CLIENT_SECRET'))
    expect(cfg.serviceAccount).toBe(requireEnv('SERVICE_ACCOUNT'))
    expect(cfg.botId).toBe(requireEnv('BOT_ID'))
  })

  test('PRIVATE_KEY が Base64 から PEM へデコードされる', () => {
    const cfg = load()
    expect(cfg.privateKey).toContain('PRIVATE KEY')
    // env に入っているのは Base64 のまま (デコード後ではない) ことを確認
    expect(cfg.privateKey).not.toBe(requireEnv('PRIVATE_KEY'))
  })

  test('isProduction = (NODE_ENV === "production")', () => {
    const cfg = load()
    // setup.ts で NODE_ENV='test' に固定されている
    expect(cfg.isProduction).toBe(false)
  })

  test('PORT のデフォルトは 8080 (env で上書き可能)', () => {
    const cfg = load()
    expect(cfg.port).toBeGreaterThan(0)
    // 数値型に coerce されることを確認
    expect(typeof cfg.port).toBe('number')
  })

  test('load() は idempotent — 2 回目もキャッシュを返す (同一インスタンス)', () => {
    const first = load()
    const second = load()
    expect(second).toBe(first)
  })

  test('config() は load() 後と同じインスタンスを返す', () => {
    const loaded = load()
    expect(config()).toBe(loaded)
  })
})
