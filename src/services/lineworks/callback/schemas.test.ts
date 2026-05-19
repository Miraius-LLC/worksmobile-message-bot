import { describe, expect, test } from 'bun:test'
import {
  callbackEventSchema,
  callbackEventTypes,
  messageContentSchema,
} from '@/services/lineworks/callback/schemas'

// =============================================================================
// fixtures (公式 docs のサンプル相当)
// =============================================================================

const messageEventFixture = {
  type: 'message',
  source: {
    userId: 'c72af563-0f21-4736-11e4-045237113344',
    channelId: '12345',
    domainId: 40029600,
  },
  issuedTime: '2026-01-04T05:16:05.716Z',
  content: { type: 'text', text: 'hello' },
}

const postbackEventFixture = {
  type: 'postback',
  source: {
    userId: 'c72af563-0f21-4736-11e4-045237113344',
    channelId: '12345',
    domainId: 40029600,
  },
  issuedTime: '2026-01-04T05:16:05.716Z',
  data: 'action=buy',
}

const joinEventFixture = {
  type: 'join',
  source: { channelId: '12345', domainId: 40029600 },
  issuedTime: '2026-01-04T05:16:05.716Z',
}

const leaveEventFixture = {
  type: 'leave',
  source: { channelId: '12345', domainId: 40029600 },
  issuedTime: '2026-01-04T05:16:05.716Z',
}

const joinedEventFixture = {
  type: 'joined',
  source: { channelId: '12345', domainId: 40029600 },
  issuedTime: '2026-01-04T05:16:05.716Z',
  members: ['userf7da-f82c-4284-13e7-030f3b4c756x'],
}

const leftEventFixture = {
  type: 'left',
  source: { channelId: '12345', domainId: 40029600 },
  issuedTime: '2026-01-04T05:16:05.716Z',
  members: ['userf7da-f82c-4284-13e7-030f3b4c756x'],
}

const beginEventFixture = {
  type: 'begin',
  source: {
    userId: 'user0001-e3e9-4063-1d22-04978003f354',
    channelId: '12345',
    domainId: 40029600,
  },
  issuedTime: '2026-01-04T05:16:05.716Z',
}

const endEventFixture = {
  type: 'end',
  source: {
    userId: 'user0001-e3e9-4063-1d22-04978003f354',
    channelId: '12345',
    domainId: 40029600,
  },
  issuedTime: '2026-01-04T05:16:05.716Z',
}

const fixtures = {
  message: messageEventFixture,
  postback: postbackEventFixture,
  join: joinEventFixture,
  leave: leaveEventFixture,
  joined: joinedEventFixture,
  left: leftEventFixture,
  begin: beginEventFixture,
  end: endEventFixture,
} as const

// =============================================================================
// 8 event 横断
// =============================================================================

describe('callbackEventSchema', () => {
  test('callbackEventTypes は 8 種類すべて含む', () => {
    expect(callbackEventTypes).toEqual([
      'message',
      'postback',
      'join',
      'leave',
      'joined',
      'left',
      'begin',
      'end',
    ])
  })

  for (const type of callbackEventTypes) {
    test(`${type} event の最小 fixture を parse できる`, () => {
      const result = callbackEventSchema.safeParse(fixtures[type])
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe(type)
      }
    })
  }

  test('未知 type は discriminatedUnion で reject される', () => {
    const result = callbackEventSchema.safeParse({
      type: 'unknown_event',
      source: { domainId: 1 },
      issuedTime: '2026-01-04T05:16:05.716Z',
    })
    expect(result.success).toBe(false)
  })

  test('type が欠落していたら reject される', () => {
    const { type: _omit, ...rest } = messageEventFixture
    const result = callbackEventSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// message event の content 別パターン
// =============================================================================

describe('message event の content 種別', () => {
  test('text content (postback フィールド付き)', () => {
    const result = callbackEventSchema.safeParse({
      ...messageEventFixture,
      content: { type: 'text', text: 'pressed', postback: 'action=press' },
    })
    expect(result.success).toBe(true)
  })

  test('location content', () => {
    const result = callbackEventSchema.safeParse({
      ...messageEventFixture,
      content: {
        type: 'location',
        address: '東京都千代田区',
        latitude: 35.658775,
        longitude: 139.705223,
      },
    })
    expect(result.success).toBe(true)
  })

  test('sticker content', () => {
    const result = callbackEventSchema.safeParse({
      ...messageEventFixture,
      content: { type: 'sticker', packageId: 'p1', stickerId: 's1' },
    })
    expect(result.success).toBe(true)
  })

  test.each(['image', 'file', 'audio', 'video'] as const)('%s content (fileId 必須)', fileType => {
    const result = callbackEventSchema.safeParse({
      ...messageEventFixture,
      content: { type: fileType, fileId: 'f1' },
    })
    expect(result.success).toBe(true)
  })

  test('未知 content type も unknownContentSchema で受け入れる (将来追加対策)', () => {
    const result = messageContentSchema.safeParse({
      type: 'unknown_future_type',
      payload: { foo: 'bar' },
    })
    expect(result.success).toBe(true)
  })

  test('content 自体が無い message event は reject', () => {
    const { content: _omit, ...rest } = messageEventFixture
    const result = callbackEventSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// source の event 種別ごとの違い
// =============================================================================

describe('source の構造', () => {
  test('message event は channelId 無し (1:1 トーク) でも parse できる', () => {
    const { channelId: _omit, ...sourceWithoutChannel } = messageEventFixture.source
    const result = callbackEventSchema.safeParse({
      ...messageEventFixture,
      source: sourceWithoutChannel,
    })
    expect(result.success).toBe(true)
  })

  test('message event の userId は必須', () => {
    const { userId: _omit, ...sourceWithoutUser } = messageEventFixture.source
    const result = callbackEventSchema.safeParse({
      ...messageEventFixture,
      source: sourceWithoutUser,
    })
    expect(result.success).toBe(false)
  })

  test('join event は userId が source に無くても parse できる', () => {
    expect(callbackEventSchema.safeParse(joinEventFixture).success).toBe(true)
  })

  test('postback event は channelId 必須 (1:1 でも 1:N でも来る前提)', () => {
    const { channelId: _omit, ...sourceWithoutChannel } = postbackEventFixture.source
    const result = callbackEventSchema.safeParse({
      ...postbackEventFixture,
      source: sourceWithoutChannel,
    })
    expect(result.success).toBe(false)
  })

  test('begin event の userId が欠落していたら reject', () => {
    const { userId: _omit, ...sourceWithoutUser } = beginEventFixture.source
    const result = callbackEventSchema.safeParse({
      ...beginEventFixture,
      source: sourceWithoutUser,
    })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// joined / left の members
// =============================================================================

describe('joined / left の members', () => {
  test('members が空配列でも parse できる', () => {
    const result = callbackEventSchema.safeParse({ ...joinedEventFixture, members: [] })
    expect(result.success).toBe(true)
  })

  test('members に複数 user が並んでも parse できる', () => {
    const result = callbackEventSchema.safeParse({
      ...leftEventFixture,
      members: ['u1', 'u2', 'u3'],
    })
    expect(result.success).toBe(true)
  })

  test('members フィールド自体が無いと reject', () => {
    const { members: _omit, ...rest } = joinedEventFixture
    const result = callbackEventSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  test('members が文字列配列以外 (例: number) なら reject', () => {
    const result = callbackEventSchema.safeParse({ ...joinedEventFixture, members: [123] })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// 型推論の sanity check (TS が落ちないこと自体が検証)
// =============================================================================

describe('CallbackEvent 型', () => {
  test('parse 後は type で narrowing できる', () => {
    const result = callbackEventSchema.safeParse(messageEventFixture)
    if (!result.success) throw new Error('expected success')
    const event = result.data
    if (event.type === 'message') {
      expect(typeof event.content.type).toBe('string')
    }
    if (event.type === 'postback') {
      // 型 narrowing で data フィールドにアクセスできる (実行はされない pseudo branch)
      expect(typeof event.data).toBe('string')
    }
  })
})
