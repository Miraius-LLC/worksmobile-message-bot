import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  _resetForTest,
  buildDedupKey,
  checkAndRegister,
  unregister,
} from '@/services/lineworks/callback/dedup'

const FIXED_NOW = new Date('2026-05-20T00:00:00Z').getTime()
const FIVE_MIN = 5 * 60 * 1000

beforeEach(() => {
  _resetForTest()
})
afterEach(() => {
  _resetForTest()
})

describe('buildDedupKey', () => {
  test('同じ body は同じ key (SHA-256 hex の 64 文字)', () => {
    const a = buildDedupKey('{"type":"message","x":1}')
    const b = buildDedupKey('{"type":"message","x":1}')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  test('body が 1 文字でも違えば key も違う', () => {
    const a = buildDedupKey('{"type":"message"}')
    const b = buildDedupKey('{"type":"messaag"}')
    expect(a).not.toBe(b)
  })

  test('空文字でも例外を投げず key を返す', () => {
    expect(buildDedupKey('')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('checkAndRegister', () => {
  test('未登録 key は false (= 重複ではない) を返し、内部に登録される', () => {
    const key = buildDedupKey('payload-1')
    expect(checkAndRegister(key, FIXED_NOW)).toBe(false)
    // 同じ now で再度呼ぶと duplicate 扱い
    expect(checkAndRegister(key, FIXED_NOW)).toBe(true)
  })

  test('TTL 切れ (5 分超過) の key は再登録され false が返る', () => {
    const key = buildDedupKey('payload-2')
    expect(checkAndRegister(key, FIXED_NOW)).toBe(false)
    // 5 分ちょうど (expiry = now + TTL_MS) は既に切れている扱い
    expect(checkAndRegister(key, FIXED_NOW + FIVE_MIN)).toBe(false)
  })

  test('TTL 直前 (5 分 - 1ms) は依然 duplicate', () => {
    const key = buildDedupKey('payload-3')
    expect(checkAndRegister(key, FIXED_NOW)).toBe(false)
    expect(checkAndRegister(key, FIXED_NOW + FIVE_MIN - 1)).toBe(true)
  })

  test('異なる key は互いに影響しない', () => {
    const k1 = buildDedupKey('payload-A')
    const k2 = buildDedupKey('payload-B')
    expect(checkAndRegister(k1, FIXED_NOW)).toBe(false)
    expect(checkAndRegister(k2, FIXED_NOW)).toBe(false)
    expect(checkAndRegister(k1, FIXED_NOW + 1000)).toBe(true)
    expect(checkAndRegister(k2, FIXED_NOW + 1000)).toBe(true)
  })

  test('TTL を跨いだ key は GC で内部から消える (Map が無限に膨らまない)', () => {
    // 100 件登録 → 5 分後に別 key を 1 件登録 → GC が走り、古い 100 件は消えるはず
    for (let i = 0; i < 100; i++) {
      checkAndRegister(buildDedupKey(`old-${i}`), FIXED_NOW)
    }
    checkAndRegister(buildDedupKey('new'), FIXED_NOW + FIVE_MIN + 1)
    // 古い key を再度同じ now で問い合わせると false (= 未登録扱い) になる
    expect(checkAndRegister(buildDedupKey('old-0'), FIXED_NOW + FIVE_MIN + 2)).toBe(false)
  })
})

describe('unregister', () => {
  test('登録済 key を削除すると再び未登録扱いになる (= 失敗時 retry が通る)', () => {
    const key = buildDedupKey('payload-X')
    expect(checkAndRegister(key, FIXED_NOW)).toBe(false)
    unregister(key)
    expect(checkAndRegister(key, FIXED_NOW)).toBe(false)
  })

  test('未登録 key の unregister は no-op (例外は出さない)', () => {
    expect(() => unregister(buildDedupKey('not-registered'))).not.toThrow()
  })
})
