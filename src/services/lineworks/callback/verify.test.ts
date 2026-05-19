import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { verifyCallbackSignature } from '@/services/lineworks/callback/verify'

const BOT_SECRET = 'test-bot-secret-12345'

function makeSignature(rawBody: string, secret: string = BOT_SECRET): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
}

describe('verifyCallbackSignature', () => {
  test('正しい署名なら true を返す', () => {
    const rawBody = '{"type":"message","source":{"userId":"u1"}}'
    const signature = makeSignature(rawBody)
    expect(verifyCallbackSignature(rawBody, signature, BOT_SECRET)).toBe(true)
  })

  test('署名が改竄されていれば false を返す', () => {
    const rawBody = '{"type":"message","source":{"userId":"u1"}}'
    const signature = makeSignature(rawBody)
    // 1 文字だけ変える (元と異なる先頭文字に置換)
    const tampered = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`
    expect(verifyCallbackSignature(rawBody, tampered, BOT_SECRET)).toBe(false)
  })

  test('body が改竄されていれば false を返す', () => {
    const rawBody = '{"type":"message","source":{"userId":"u1"}}'
    const signature = makeSignature(rawBody)
    const tamperedBody = '{"type":"message","source":{"userId":"u2"}}'
    expect(verifyCallbackSignature(tamperedBody, signature, BOT_SECRET)).toBe(false)
  })

  test('秘密鍵が違えば false を返す', () => {
    const rawBody = '{"type":"message"}'
    const signature = makeSignature(rawBody, 'wrong-secret')
    expect(verifyCallbackSignature(rawBody, signature, BOT_SECRET)).toBe(false)
  })

  test('署名ヘッダが null なら false を返す', () => {
    expect(verifyCallbackSignature('{"type":"message"}', null, BOT_SECRET)).toBe(false)
  })

  test('署名ヘッダが undefined なら false を返す', () => {
    expect(verifyCallbackSignature('{"type":"message"}', undefined, BOT_SECRET)).toBe(false)
  })

  test('署名ヘッダが空文字なら false を返す', () => {
    expect(verifyCallbackSignature('{"type":"message"}', '', BOT_SECRET)).toBe(false)
  })

  test('署名長が違っても crash せず false を返す (timing-safe 比較の前段 length check)', () => {
    const rawBody = '{"type":"message"}'
    // 通常の Base64 出力 (44 文字) より明らかに短い文字列
    expect(verifyCallbackSignature(rawBody, 'short', BOT_SECRET)).toBe(false)
  })

  test('日本語 / マルチバイト文字を含む body でも UTF-8 として一貫検証される', () => {
    const rawBody = JSON.stringify({
      type: 'message',
      content: { type: 'text', text: 'こんにちは 🌸' },
    })
    const signature = makeSignature(rawBody)
    expect(verifyCallbackSignature(rawBody, signature, BOT_SECRET)).toBe(true)
  })

  test('空 body でも署名計算は成立する (LINE WORKS が空ペイロードを送ることは無いが防御的に)', () => {
    const rawBody = ''
    const signature = makeSignature(rawBody)
    expect(verifyCallbackSignature(rawBody, signature, BOT_SECRET)).toBe(true)
  })
})
