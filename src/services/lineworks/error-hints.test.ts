import { describe, expect, test } from 'bun:test'
import { getErrorHint, knownErrorCodes } from '@/services/lineworks/error-hints'

describe('getErrorHint', () => {
  test('既知 code は日本語 hint を返す', () => {
    const hint = getErrorHint('ACCESS_DENIED')
    expect(hint).toBeDefined()
    expect(hint).toContain('Bot')
  })

  test.each([...knownErrorCodes()])('%s には hint が登録されている', (code: string) => {
    expect(getErrorHint(code)).toBeDefined()
  })

  test('未知 code は undefined を返す', () => {
    expect(getErrorHint('UNKNOWN_FUTURE_CODE')).toBeUndefined()
  })

  test('code が undefined / 空文字なら undefined を返す', () => {
    expect(getErrorHint(undefined)).toBeUndefined()
    expect(getErrorHint('')).toBeUndefined()
  })
})

describe('knownErrorCodes', () => {
  test('主要なコードが含まれる', () => {
    const codes = knownErrorCodes()
    expect(codes).toContain('ACCESS_DENIED')
    expect(codes).toContain('UNAUTHORIZED')
    expect(codes).toContain('NOT_FOUND')
    expect(codes).toContain('CALLBACK_NOT_ENABLED')
  })
})
