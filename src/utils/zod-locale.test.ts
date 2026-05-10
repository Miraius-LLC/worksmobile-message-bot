import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

// installJapaneseErrorMap() は test-helpers/setup.ts で 1 度だけ呼ばれる。
// 個別 test から再度呼ぶ必要は無い

describe('utils/zod-locale: installJapaneseErrorMap', () => {
  test('invalid_type: 期待型を含む日本語メッセージ', () => {
    const result = z.string().safeParse(123)
    expect(result.success).toBe(false)
    if (result.success) return
    const msg = result.error.issues[0]?.message ?? ''
    expect(msg).toContain('string')
    expect(msg).toContain('指定してください')
  })

  test('too_small (string): 必須メッセージ', () => {
    const result = z.string().min(1).safeParse('')
    if (result.success) return
    expect(result.error.issues[0]?.message ?? '').toContain('必須')
  })

  test('too_big (string): N 文字以内', () => {
    const result = z.string().max(3).safeParse('abcd')
    if (result.success) return
    expect(result.error.issues[0]?.message ?? '').toContain('3 文字以内')
  })

  test('too_small (array): N 件以上必要', () => {
    const result = z.array(z.string()).min(2).safeParse([])
    if (result.success) return
    expect(result.error.issues[0]?.message ?? '').toContain('2 件以上')
  })

  test('too_big (array): 項目数は最大 N', () => {
    const result = z.array(z.string()).max(2).safeParse(['a', 'b', 'c'])
    if (result.success) return
    expect(result.error.issues[0]?.message ?? '').toContain('最大 2')
  })

  test('invalid_format: 形式が不正です', () => {
    const result = z.string().regex(/^\d+$/).safeParse('abc')
    if (result.success) return
    expect(result.error.issues[0]?.message ?? '').toContain('形式が不正')
  })

  test('明示的な { message } はそのまま優先される', () => {
    const result = z.string().min(1, { message: 'カスタム必須メッセージ' }).safeParse('')
    if (result.success) return
    expect(result.error.issues[0]?.message).toBe('カスタム必須メッセージ')
  })

  test('path が入っているとき: パスを含むメッセージ', () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 123 })
    if (result.success) return
    expect(result.error.issues[0]?.message ?? '').toContain("'name'")
  })
})
