import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { API_BASE } from '@/services/lineworks/api'
import {
  type MessageType,
  messageSchemas,
  messageTypes,
  sendMessageByType,
} from '@/services/lineworks/messages'

// 全 type の wire format を一度に検証する feature テスト。schema parse + dispatcher の
// URL 組み立て + content wrap を「型の追加で漏れが出ない」レベルまで担保する

const fixtures: Record<MessageType, Record<string, unknown>> = {
  text: { text: 'hi' },
  sticker: { packageId: '1', stickerId: '2' },
  image: { fileId: 'F1' },
  file: { fileId: 'F1' },
  audio: { fileId: 'F1' },
  video: { fileId: 'F1' },
  location: {
    title: '本社',
    address: '東京都千代田区紀尾井町 1-3',
    latitude: 35.67966,
    longitude: 139.73669,
  },
  link: {
    contentText: 'c',
    linkText: 'L',
    link: 'https://example.com/x',
  },
  button_template: {
    contentText: 'c',
    actions: [{ type: 'message', label: 'L' }],
  },
  list_template: { elements: [{ title: 'T' }] },
  carousel: {
    columns: [
      {
        fileId: 'F1',
        text: 'T',
        actions: [{ type: 'message', label: 'L' }],
      },
    ],
  },
  image_carousel: { columns: [{ fileId: 'F1' }] },
  flex: { altText: 'a', contents: { type: 'bubble' } },
}

let originalFetch: typeof globalThis.fetch
let fetchSpy: ReturnType<typeof mock<(url: string | URL, init?: RequestInit) => Promise<Response>>>

beforeEach(() => {
  originalFetch = globalThis.fetch
  fetchSpy = mock(async () => new Response('', { status: 200 }))
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('messageSchemas: 全 type 横断 parse', () => {
  for (const type of messageTypes) {
    test(`${type}: 最小 fixture が parse できる`, () => {
      const result = messageSchemas[type].safeParse(fixtures[type])
      expect(result.success).toBe(true)
    })
  }
})

describe('sendMessageByType: URL + wire format', () => {
  test('channelId 指定 → channels URL を組み立てる', async () => {
    await sendMessageByType('bot-X', 'tok', { channelId: 'C1' }, 'text', { text: 'hi' })
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(`${API_BASE}/bots/bot-X/channels/C1/messages`)
  })

  test('userId 指定 → users URL を組み立てる', async () => {
    await sendMessageByType('bot-X', 'tok', { userId: 'U1' }, 'flex', {
      altText: 'a',
      contents: { type: 'bubble' },
    })
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(`${API_BASE}/bots/bot-X/users/U1/messages`)
  })

  test('body は `{ content: { type, ...body } }` の形で送信される', async () => {
    await sendMessageByType('bot-X', 'tok', { channelId: 'C1' }, 'text', { text: 'hi' })
    const sent = JSON.parse((fetchSpy.mock.calls[0]?.[1]?.body as string) ?? '{}')
    expect(sent).toEqual({ content: { type: 'text', text: 'hi' } })
  })

  test('全 13 type で fetch が 1 回呼ばれ、content.type が type と一致する', async () => {
    for (const type of messageTypes) {
      fetchSpy.mockClear()
      await sendMessageByType('bot-X', 'tok', { channelId: 'C1' }, type, fixtures[type] as never)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const sent = JSON.parse((fetchSpy.mock.calls[0]?.[1]?.body as string) ?? '{}')
      expect(sent.content.type).toBe(type)
    }
  })
})
