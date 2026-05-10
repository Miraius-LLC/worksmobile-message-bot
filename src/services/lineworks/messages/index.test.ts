import { describe, expect, test } from 'bun:test'
import { messageSchemas, messageTypes } from '@/services/lineworks/messages'

describe('services/lineworks/messages', () => {
  test('messageTypes は LINE WORKS の 10 種類', () => {
    expect(messageTypes).toEqual([
      'text',
      'sticker',
      'image',
      'file',
      'link',
      'button_template',
      'list_template',
      'carousel',
      'image_carousel',
      'flex',
    ])
  })

  describe('text schema: 文字数制限', () => {
    const schema = messageSchemas.text
    test('1 文字 OK', () => {
      expect(schema.safeParse({ text: 'a' }).success).toBe(true)
    })
    test('空文字は NG', () => {
      expect(schema.safeParse({ text: '' }).success).toBe(false)
    })
    test('2000 文字は OK / 2001 文字は NG', () => {
      expect(schema.safeParse({ text: 'a'.repeat(2000) }).success).toBe(true)
      expect(schema.safeParse({ text: 'a'.repeat(2001) }).success).toBe(false)
    })
  })

  describe('image schema: 排他必須 + 画像 URL チェック', () => {
    const schema = messageSchemas.image
    test('previewImageUrl のみで OK', () => {
      expect(schema.safeParse({ previewImageUrl: 'https://example.com/a.png' }).success).toBe(true)
    })
    test('fileId のみで OK', () => {
      expect(schema.safeParse({ fileId: 'fid' }).success).toBe(true)
    })
    test('全部空は NG (どれか 1 つ必須)', () => {
      expect(schema.safeParse({}).success).toBe(false)
    })
    test('画像 URL は HTTPS 必須', () => {
      expect(schema.safeParse({ previewImageUrl: 'http://example.com/a.png' }).success).toBe(false)
    })
    test('許可されていない拡張子は NG', () => {
      expect(schema.safeParse({ previewImageUrl: 'https://example.com/a.exe' }).success).toBe(false)
    })
    test('拡張子なしの URL は OK', () => {
      expect(schema.safeParse({ previewImageUrl: 'https://example.com/path' }).success).toBe(true)
    })
  })

  describe('quickReply: action は loose で未知フィールドを保持', () => {
    test('postback action は postback プロパティが必須 + 未知フィールド strip されない', () => {
      const result = messageSchemas.text.safeParse({
        text: 'hi',
        quickReply: {
          items: [
            {
              action: {
                type: 'postback',
                label: 'L',
                postback: 'p',
                data: 'd',
                displayText: 't',
              },
            },
          ],
        },
      })
      expect(result.success).toBe(true)
      if (!result.success) return
      // text フィールドが strip されないことの確認 (regression test)
      const action = result.data.quickReply?.items[0]?.action as Record<string, unknown>
      expect(action['data']).toBe('d')
      expect(action['displayText']).toBe('t')
    })

    test('postback action で postback プロパティが欠落していると NG', () => {
      const result = messageSchemas.text.safeParse({
        text: 'hi',
        quickReply: {
          items: [{ action: { type: 'postback', label: 'L' } }],
        },
      })
      expect(result.success).toBe(false)
    })

    test('uri action: 不正な URL は NG', () => {
      const result = messageSchemas.text.safeParse({
        text: 'hi',
        quickReply: {
          items: [{ action: { type: 'uri', label: 'L', uri: 'not-a-url' } }],
        },
      })
      expect(result.success).toBe(false)
    })

    test('quickReply.items は 1 件以上必要', () => {
      const result = messageSchemas.text.safeParse({
        text: 'hi',
        quickReply: { items: [] },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('flex schema', () => {
    const schema = messageSchemas.flex
    test('altText + contents で OK', () => {
      expect(schema.safeParse({ altText: 'a', contents: { type: 'bubble' } }).success).toBe(true)
    })
    test('altText 欠落は NG', () => {
      expect(schema.safeParse({ contents: { type: 'bubble' } }).success).toBe(false)
    })
    test('altText は 400 文字まで', () => {
      expect(schema.safeParse({ altText: 'a'.repeat(400), contents: {} }).success).toBe(true)
      expect(schema.safeParse({ altText: 'a'.repeat(401), contents: {} }).success).toBe(false)
    })
  })

  describe('carousel: column.text は画像/title 有無で文字数上限が変わる', () => {
    const schema = messageSchemas.carousel
    const buildColumn = (overrides: Record<string, unknown>) => ({
      text: 'T',
      actions: [{ type: 'message', label: 'L' }],
      ...overrides,
    })

    test('画像あり: text は 60 文字まで', () => {
      const ok = schema.safeParse({
        columns: [
          buildColumn({
            originalContentUrl: 'https://example.com/a.png',
            text: 'a'.repeat(60),
          }),
        ],
      })
      const ng = schema.safeParse({
        columns: [
          buildColumn({
            originalContentUrl: 'https://example.com/a.png',
            text: 'a'.repeat(61),
          }),
        ],
      })
      expect(ok.success).toBe(true)
      expect(ng.success).toBe(false)
    })

    test('画像なし / title なし: text は 120 文字まで', () => {
      const ok = schema.safeParse({
        columns: [buildColumn({ fileId: 'F1', text: 'a'.repeat(120) })],
      })
      const ng = schema.safeParse({
        columns: [buildColumn({ fileId: 'F1', text: 'a'.repeat(121) })],
      })
      expect(ok.success).toBe(true)
      expect(ng.success).toBe(false)
    })

    test('column には originalContentUrl か fileId のいずれかが必要', () => {
      const result = schema.safeParse({
        columns: [buildColumn({})], // どちらも無い
      })
      expect(result.success).toBe(false)
    })
  })
})
