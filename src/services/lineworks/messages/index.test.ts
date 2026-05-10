import { describe, expect, test } from 'bun:test'
import { messageSchemas, messageTypes } from '@/services/lineworks/messages'

describe('services/lineworks/messages', () => {
  test('messageTypes は LINE WORKS の 13 種類', () => {
    expect(messageTypes).toEqual([
      'text',
      'sticker',
      'image',
      'file',
      'audio',
      'video',
      'location',
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
    test('previewImageUrl + originalContentUrl 両方で OK', () => {
      expect(
        schema.safeParse({
          previewImageUrl: 'https://example.com/a.png',
          originalContentUrl: 'https://example.com/a.png',
        }).success,
      ).toBe(true)
    })
    test('fileId のみで OK', () => {
      expect(schema.safeParse({ fileId: 'fid' }).success).toBe(true)
    })
    test('previewImageUrl だけは NG (spec: preview と original は両方必須)', () => {
      expect(schema.safeParse({ previewImageUrl: 'https://example.com/a.png' }).success).toBe(false)
    })
    test('originalContentUrl だけも NG', () => {
      expect(schema.safeParse({ originalContentUrl: 'https://example.com/a.png' }).success).toBe(
        false,
      )
    })
    test('全部空は NG', () => {
      expect(schema.safeParse({}).success).toBe(false)
    })
    test('画像 URL は HTTPS 必須', () => {
      expect(
        schema.safeParse({
          previewImageUrl: 'http://example.com/a.png',
          originalContentUrl: 'http://example.com/a.png',
        }).success,
      ).toBe(false)
    })
    test('許可されていない拡張子は NG', () => {
      expect(
        schema.safeParse({
          previewImageUrl: 'https://example.com/a.exe',
          originalContentUrl: 'https://example.com/a.exe',
        }).success,
      ).toBe(false)
    })
    test('拡張子なしの URL は OK', () => {
      expect(
        schema.safeParse({
          previewImageUrl: 'https://example.com/path',
          originalContentUrl: 'https://example.com/path',
        }).success,
      ).toBe(true)
    })
  })

  describe('quickReply: action は loose で未知フィールドを保持', () => {
    test('postback action は data プロパティが必須 (spec 準拠) + label/displayText も保持', () => {
      const result = messageSchemas.text.safeParse({
        text: 'hi',
        quickReply: {
          items: [
            {
              action: {
                type: 'postback',
                label: 'L',
                data: 'd',
                displayText: 't',
              },
            },
          ],
        },
      })
      expect(result.success).toBe(true)
      if (!result.success) return
      const action = result.data.quickReply?.items[0]?.action as Record<string, unknown>
      expect(action['data']).toBe('d')
      expect(action['displayText']).toBe('t')
    })

    test('postback action で data が欠落していると NG (旧実装は postback フィールドを見ていた回帰)', () => {
      const result = messageSchemas.text.safeParse({
        text: 'hi',
        quickReply: {
          items: [{ action: { type: 'postback', label: 'L' } }],
        },
      })
      expect(result.success).toBe(false)
    })

    test('postback action で旧名 postback フィールドだけだと NG (data が必要)', () => {
      const result = messageSchemas.text.safeParse({
        text: 'hi',
        quickReply: {
          items: [{ action: { type: 'postback', label: 'L', postback: 'old-style' } }],
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

  describe('URL バリデーション (WHATWG URL 経由)', () => {
    const schema = messageSchemas.link

    test('ポート付き URL を受け入れる (旧正規表現は弾いていた回帰)', () => {
      const result = schema.safeParse({
        contentText: 'C',
        linkText: 'L',
        link: 'https://example.com:8080/path',
      })
      expect(result.success).toBe(true)
    })

    test('IPv4 URL を受け入れる', () => {
      const result = schema.safeParse({
        contentText: 'C',
        linkText: 'L',
        link: 'http://192.168.1.1/x',
      })
      expect(result.success).toBe(true)
    })

    test('IPv6 URL を受け入れる', () => {
      const result = schema.safeParse({
        contentText: 'C',
        linkText: 'L',
        link: 'http://[::1]:8080/x',
      })
      expect(result.success).toBe(true)
    })

    test('http / https 以外は弾く (ftp など)', () => {
      const result = schema.safeParse({
        contentText: 'C',
        linkText: 'L',
        link: 'ftp://example.com/x',
      })
      expect(result.success).toBe(false)
    })

    test('壊れた URL は弾く', () => {
      const result = schema.safeParse({
        contentText: 'C',
        linkText: 'L',
        link: 'not a url',
      })
      expect(result.success).toBe(false)
    })

    test('imageUrl は https のみ (http は弾く)', () => {
      const imageSchema = messageSchemas.image
      const ok = imageSchema.safeParse({
        previewImageUrl: 'https://example.com:443/a.png',
        originalContentUrl: 'https://example.com:443/a.png',
      })
      const ng = imageSchema.safeParse({
        previewImageUrl: 'http://example.com/a.png',
        originalContentUrl: 'http://example.com/a.png',
      })
      expect(ok.success).toBe(true)
      expect(ng.success).toBe(false)
    })

    test('file の originalContentUrl は HTTPS のみ (http は弾く)', () => {
      const fileSchema = messageSchemas.file
      const ok = fileSchema.safeParse({ originalContentUrl: 'https://example.com/a.pdf' })
      const ng = fileSchema.safeParse({ originalContentUrl: 'http://example.com/a.pdf' })
      expect(ok.success).toBe(true)
      expect(ng.success).toBe(false)
    })
  })

  describe('spec 準拠の境界 (上限件数 / 文字数)', () => {
    test('list_template.elements は最大 4 件 (5 件は NG)', () => {
      const schema = messageSchemas.list_template
      const buildElement = (i: number) => ({ title: `t${i}` })
      const okBody = { elements: Array.from({ length: 4 }, (_, i) => buildElement(i)) }
      const ngBody = { elements: Array.from({ length: 5 }, (_, i) => buildElement(i)) }
      expect(schema.safeParse(okBody).success).toBe(true)
      expect(schema.safeParse(ngBody).success).toBe(false)
    })

    test('button_template.actions は最大 10 件 (11 件は NG)', () => {
      const schema = messageSchemas.button_template
      const action = { type: 'message' as const, label: 'L' }
      const okBody = {
        contentText: 'C',
        actions: Array.from({ length: 10 }, () => action),
      }
      const ngBody = {
        contentText: 'C',
        actions: Array.from({ length: 11 }, () => action),
      }
      expect(schema.safeParse(okBody).success).toBe(true)
      expect(schema.safeParse(ngBody).success).toBe(false)
    })

    test('quickReply.items は最大 13 件 (14 件は NG)', () => {
      const schema = messageSchemas.text
      const item = { action: { type: 'message' as const, label: 'L' } }
      expect(
        schema.safeParse({
          text: 'hi',
          quickReply: { items: Array.from({ length: 13 }, () => item) },
        }).success,
      ).toBe(true)
      expect(
        schema.safeParse({
          text: 'hi',
          quickReply: { items: Array.from({ length: 14 }, () => item) },
        }).success,
      ).toBe(false)
    })

    test('carousel.imageAspectRatio は enum (rectangle / square のみ)', () => {
      const schema = messageSchemas.carousel
      const baseColumn = {
        originalContentUrl: 'https://example.com/a.png',
        text: 'T',
        actions: [{ type: 'message' as const, label: 'L' }],
      }
      expect(schema.safeParse({ columns: [baseColumn], imageAspectRatio: 'square' }).success).toBe(
        true,
      )
      expect(schema.safeParse({ columns: [baseColumn], imageAspectRatio: 'wide' }).success).toBe(
        false,
      )
    })

    test('carousel.columns[].actions は最大 3 件 (4 件は NG)', () => {
      const schema = messageSchemas.carousel
      const action = { type: 'message' as const, label: 'L' }
      const buildColumns = (n: number) => [
        {
          originalContentUrl: 'https://example.com/a.png',
          text: 'T',
          actions: Array.from({ length: n }, () => action),
        },
      ]
      expect(schema.safeParse({ columns: buildColumns(3) }).success).toBe(true)
      expect(schema.safeParse({ columns: buildColumns(4) }).success).toBe(false)
    })

    test('carousel: 全 columns で actions 件数を揃える必要がある', () => {
      const schema = messageSchemas.carousel
      const action = { type: 'message' as const, label: 'L' }
      const col = (n: number) => ({
        originalContentUrl: 'https://example.com/a.png',
        text: 'T',
        actions: Array.from({ length: n }, () => action),
      })
      // 全 column が同数 (2 件ずつ) → OK
      expect(schema.safeParse({ columns: [col(2), col(2), col(2)] }).success).toBe(true)
      // column 間で件数が違う → NG
      expect(schema.safeParse({ columns: [col(2), col(3)] }).success).toBe(false)
    })

    test('image_carousel の action.label は最大 12 文字', () => {
      const schema = messageSchemas.image_carousel
      const buildColumn = (label: string) => ({
        originalContentUrl: 'https://example.com/a.png',
        action: { type: 'message' as const, label },
      })
      expect(schema.safeParse({ columns: [buildColumn('a'.repeat(12))] }).success).toBe(true)
      expect(schema.safeParse({ columns: [buildColumn('a'.repeat(13))] }).success).toBe(false)
    })

    test('label の基本上限は 20 文字 (button_template など)', () => {
      const schema = messageSchemas.button_template
      const action = { type: 'message' as const }
      expect(
        schema.safeParse({
          contentText: 'C',
          actions: [{ ...action, label: 'a'.repeat(20) }],
        }).success,
      ).toBe(true)
      expect(
        schema.safeParse({
          contentText: 'C',
          actions: [{ ...action, label: 'a'.repeat(21) }],
        }).success,
      ).toBe(false)
    })

    test('list_template.coverData.title / subtitle が受け入れられる', () => {
      const schema = messageSchemas.list_template
      const result = schema.safeParse({
        coverData: { title: 't', subtitle: 's' },
        elements: [{ title: 'e' }],
      })
      expect(result.success).toBe(true)
    })

    test('postback action: data は 300 文字まで', () => {
      const schema = messageSchemas.text
      const buildAction = (data: string) => ({
        text: 'hi',
        quickReply: { items: [{ action: { type: 'postback' as const, label: 'L', data } }] },
      })
      expect(schema.safeParse(buildAction('a'.repeat(300))).success).toBe(true)
      expect(schema.safeParse(buildAction('a'.repeat(301))).success).toBe(false)
    })
  })

  describe('audio schema', () => {
    const schema = messageSchemas.audio
    test('originalContentUrl 単独で OK', () => {
      expect(schema.safeParse({ originalContentUrl: 'https://example.com/a.mp3' }).success).toBe(
        true,
      )
    })
    test('fileId 単独で OK', () => {
      expect(schema.safeParse({ fileId: 'F1' }).success).toBe(true)
    })
    test('両方空は NG', () => {
      expect(schema.safeParse({}).success).toBe(false)
    })
    test('originalContentUrl は HTTPS のみ', () => {
      expect(schema.safeParse({ originalContentUrl: 'http://example.com/a.mp3' }).success).toBe(
        false,
      )
    })
    test('拡張子チェックは無い (.mp3 でなくても通る)', () => {
      expect(schema.safeParse({ originalContentUrl: 'https://example.com/a.wav' }).success).toBe(
        true,
      )
    })
  })

  describe('video schema', () => {
    const schema = messageSchemas.video
    test('preview + original 両方で OK', () => {
      expect(
        schema.safeParse({
          previewImageUrl: 'https://example.com/p.png',
          originalContentUrl: 'https://example.com/v.mp4',
        }).success,
      ).toBe(true)
    })
    test('fileId 単独で OK', () => {
      expect(schema.safeParse({ fileId: 'F1' }).success).toBe(true)
    })
    test('preview のみ / original のみは NG', () => {
      expect(schema.safeParse({ previewImageUrl: 'https://example.com/p.png' }).success).toBe(false)
      expect(schema.safeParse({ originalContentUrl: 'https://example.com/v.mp4' }).success).toBe(
        false,
      )
    })
    test('previewImageUrl は PNG 形式限定 (jpg は NG)', () => {
      expect(
        schema.safeParse({
          previewImageUrl: 'https://example.com/p.jpg',
          originalContentUrl: 'https://example.com/v.mp4',
        }).success,
      ).toBe(false)
    })
    test('原本動画 URL は HTTPS のみ', () => {
      expect(
        schema.safeParse({
          previewImageUrl: 'https://example.com/p.png',
          originalContentUrl: 'http://example.com/v.mp4',
        }).success,
      ).toBe(false)
    })
  })

  describe('location schema', () => {
    const schema = messageSchemas.location
    const valid = {
      title: '本社',
      address: '東京都千代田区紀尾井町 1-3',
      latitude: 35.67966,
      longitude: 139.73669,
    }
    test('全フィールド揃えば OK', () => {
      expect(schema.safeParse(valid).success).toBe(true)
    })
    test('title 欠落は NG', () => {
      expect(schema.safeParse({ ...valid, title: undefined }).success).toBe(false)
    })
    test('address 欠落は NG', () => {
      expect(schema.safeParse({ ...valid, address: undefined }).success).toBe(false)
    })
    test('title / address は最大 100 文字', () => {
      expect(schema.safeParse({ ...valid, title: 'a'.repeat(100) }).success).toBe(true)
      expect(schema.safeParse({ ...valid, title: 'a'.repeat(101) }).success).toBe(false)
    })
    test('latitude は -90 〜 90 の範囲', () => {
      expect(schema.safeParse({ ...valid, latitude: -90 }).success).toBe(true)
      expect(schema.safeParse({ ...valid, latitude: 90 }).success).toBe(true)
      expect(schema.safeParse({ ...valid, latitude: -90.1 }).success).toBe(false)
      expect(schema.safeParse({ ...valid, latitude: 90.1 }).success).toBe(false)
    })
    test('longitude は -180 〜 180 の範囲', () => {
      expect(schema.safeParse({ ...valid, longitude: -180 }).success).toBe(true)
      expect(schema.safeParse({ ...valid, longitude: 180 }).success).toBe(true)
      expect(schema.safeParse({ ...valid, longitude: -180.1 }).success).toBe(false)
      expect(schema.safeParse({ ...valid, longitude: 180.1 }).success).toBe(false)
    })
    test('latitude が文字列は NG (型エラー)', () => {
      expect(schema.safeParse({ ...valid, latitude: '35.67' }).success).toBe(false)
    })
  })
})
