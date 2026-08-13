import { describe, expect, test } from 'bun:test'
import { requireEnv } from '@/test-helpers/utils'
import {
  _resetConfigCacheForTest,
  config,
  isPemPrivateKey,
  load,
  parseConfig,
} from '@/utils/config'

// test-helpers/setup.ts が PRIVATE_KEY (実 RSA 鍵) + CLIENT_ID 等を埋めて load() 済み

describe('utils/config', () => {
  test('OAUTH_SCOPE の設定に応じた enum バリデーションとデフォルト値 (bot)', () => {
    const validEnv = {
      CLIENT_ID: requireEnv('CLIENT_ID'),
      CLIENT_SECRET: requireEnv('CLIENT_SECRET'),
      SERVICE_ACCOUNT: requireEnv('SERVICE_ACCOUNT'),
      PRIVATE_KEY: requireEnv('PRIVATE_KEY'),
      BOT_ID: requireEnv('BOT_ID'),
      BASIC_ID: requireEnv('BASIC_ID'),
      BASIC_PASS: requireEnv('BASIC_PASS'),
      BOT_SECRET: requireEnv('BOT_SECRET'),
    }

    // 未設定時はデフォルト bot
    expect(parseConfig(validEnv).oauthScope).toBe('bot')

    // 許容値: bot.message, bot.read, bot
    expect(parseConfig({ ...validEnv, OAUTH_SCOPE: 'bot.message' }).oauthScope).toBe('bot.message')
    expect(parseConfig({ ...validEnv, OAUTH_SCOPE: 'bot.read' }).oauthScope).toBe('bot.read')
    expect(parseConfig({ ...validEnv, OAUTH_SCOPE: 'bot' }).oauthScope).toBe('bot')

    // 不正値は拒否 (空文字は未設定扱い/botにフォールバック)
    expect(parseConfig({ ...validEnv, OAUTH_SCOPE: '' }).oauthScope).toBe('bot')
    expect(() => parseConfig({ ...validEnv, OAUTH_SCOPE: 'invalid' })).toThrow()
    expect(() => parseConfig({ ...validEnv, OAUTH_SCOPE: 'bot.write' })).toThrow()
  })

  test('OAUTH_SCOPE が load() 経由で Config.oauthScope へ反映される', () => {
    const origScope = process.env['OAUTH_SCOPE']
    try {
      Reflect.deleteProperty(process.env, 'OAUTH_SCOPE')
      _resetConfigCacheForTest()
      expect(load().oauthScope).toBe('bot')

      process.env['OAUTH_SCOPE'] = 'bot.message'
      _resetConfigCacheForTest()
      expect(load().oauthScope).toBe('bot.message')
    } finally {
      if (origScope !== undefined) {
        process.env['OAUTH_SCOPE'] = origScope
      } else {
        Reflect.deleteProperty(process.env, 'OAUTH_SCOPE')
      }
      _resetConfigCacheForTest()
      load()
    }
  })

  test('parseConfig() は明示された runtime env を変換する', () => {
    const validEnv = {
      CLIENT_ID: requireEnv('CLIENT_ID'),
      CLIENT_SECRET: requireEnv('CLIENT_SECRET'),
      SERVICE_ACCOUNT: requireEnv('SERVICE_ACCOUNT'),
      PRIVATE_KEY: requireEnv('PRIVATE_KEY'),
      BOT_ID: requireEnv('BOT_ID'),
      BASIC_ID: requireEnv('BASIC_ID'),
      BASIC_PASS: requireEnv('BASIC_PASS'),
      BOT_SECRET: requireEnv('BOT_SECRET'),
    }

    expect(parseConfig(validEnv).botId).toBe(validEnv.BOT_ID)
    expect(
      parseConfig({ ...validEnv, FORWARD_CALLBACK_URL: 'https://upstream.example.test/callback' })
        .forwardCallbackUrl,
    ).toBe('https://upstream.example.test/callback')
    expect(
      parseConfig({ ...validEnv, FORWARD_CALLBACK_URL: '' }).forwardCallbackUrl,
    ).toBeUndefined()
    expect(() => parseConfig({ ...validEnv, BOT_SECRET: '' })).toThrow()
  })

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

  test('botSecret が env からそのまま反映される (Callback 署名検証用)', () => {
    const cfg = load()
    expect(cfg.botSecret).toBe(requireEnv('BOT_SECRET'))
    expect(cfg.botSecret.length).toBeGreaterThan(0)
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

describe('utils/config: isPemPrivateKey', () => {
  test('PKCS#8 BEGIN 行は通る', () => {
    expect(
      isPemPrivateKey('-----BEGIN PRIVATE KEY-----\nMIIBVw...\n-----END PRIVATE KEY-----'),
    ).toBe(true)
  })

  test('PKCS#1 (RSA) BEGIN 行も通る', () => {
    expect(
      isPemPrivateKey('-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----'),
    ).toBe(true)
  })

  test('EC BEGIN 行も通る (BEGIN [A-Z ]* PRIVATE KEY)', () => {
    expect(
      isPemPrivateKey('-----BEGIN EC PRIVATE KEY-----\nMHcCA...\n-----END EC PRIVATE KEY-----'),
    ).toBe(true)
  })

  test('文中に "PRIVATE KEY" を含むだけのゴミは弾く (旧 includes() は通っていた)', () => {
    expect(isPemPrivateKey('foo PRIVATE KEY bar')).toBe(false)
  })

  test('BEGIN マーカーが無い public key 等は弾く', () => {
    expect(isPemPrivateKey('-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----')).toBe(false)
  })

  test('空文字は弾く', () => {
    expect(isPemPrivateKey('')).toBe(false)
  })
})
