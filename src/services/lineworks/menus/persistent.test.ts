import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  deletePersistentMenu,
  getPersistentMenu,
  type PersistentMenu,
  persistentMenuActionSchema,
  persistentMenuSchema,
  setPersistentMenu,
} from '@/services/lineworks/menus/persistent'

// =============================================================================
// Schema 検証
// =============================================================================

describe('persistentMenuActionSchema (action 別)', () => {
  test('message action は label / text 必須、postback と i18n は任意', () => {
    expect(
      persistentMenuActionSchema.safeParse({
        type: 'message',
        label: 'メッセージ',
        text: 'hello',
      }).success,
    ).toBe(true)
  })

  test('uri action は HTTPS URL を受け付ける', () => {
    expect(
      persistentMenuActionSchema.safeParse({
        type: 'uri',
        label: '公式',
        uri: 'https://example.com',
      }).success,
    ).toBe(true)
  })

  test('uri action の uri が非 HTTP/HTTPS なら reject', () => {
    expect(
      persistentMenuActionSchema.safeParse({
        type: 'uri',
        label: 'ftp',
        uri: 'ftp://example.com',
      }).success,
    ).toBe(false)
  })

  test('copy action は copyText 必須', () => {
    expect(
      persistentMenuActionSchema.safeParse({
        type: 'copy',
        label: 'コピー',
        copyText: 'copied content',
      }).success,
    ).toBe(true)
  })

  test('未知 type は reject (discriminatedUnion)', () => {
    expect(
      persistentMenuActionSchema.safeParse({
        type: 'foo',
        label: 'x',
      } as never).success,
    ).toBe(false)
  })

  test('label の最大長 1000 を超えると reject', () => {
    expect(
      persistentMenuActionSchema.safeParse({
        type: 'message',
        label: 'a'.repeat(1001),
        text: 'x',
      }).success,
    ).toBe(false)
  })

  test('message.text の最大長 300 を超えると reject', () => {
    expect(
      persistentMenuActionSchema.safeParse({
        type: 'message',
        label: 'ok',
        text: 'a'.repeat(301),
      }).success,
    ).toBe(false)
  })
})

describe('persistentMenuSchema (全体)', () => {
  test('actions 0〜4 件は OK', () => {
    for (const count of [0, 1, 4]) {
      const actions = Array.from({ length: count }, (_, i) => ({
        type: 'message' as const,
        label: `btn${i}`,
        text: `text${i}`,
      }))
      expect(persistentMenuSchema.safeParse({ content: { actions } }).success).toBe(true)
    }
  })

  test('actions 5 件は reject (max 4)', () => {
    const actions = Array.from({ length: 5 }, (_, i) => ({
      type: 'message' as const,
      label: `btn${i}`,
      text: `text${i}`,
    }))
    expect(persistentMenuSchema.safeParse({ content: { actions } }).success).toBe(false)
  })

  test('content フィールド欠落は reject', () => {
    expect(persistentMenuSchema.safeParse({}).success).toBe(false)
  })
})

// =============================================================================
// 公開関数 (set / get / delete) の HTTP 振る舞い
// =============================================================================

const validMenu: PersistentMenu = {
  content: {
    actions: [
      { type: 'message', label: 'hi', text: 'hello' },
      { type: 'uri', label: 'go', uri: 'https://example.com' },
    ],
  },
}

let originalFetch: typeof globalThis.fetch
let lastRequest: { url: string; init: RequestInit | undefined } | undefined

function installFetch(response: () => Response) {
  lastRequest = undefined
  globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
    lastRequest = { url: String(url), init }
    return response()
  }) as unknown as typeof globalThis.fetch
}

beforeEach(() => {
  originalFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('setPersistentMenu', () => {
  test('POST /bots/{botId}/persistentmenu を application/json で叩く', async () => {
    installFetch(() => new Response(JSON.stringify(validMenu), { status: 201 }))
    await setPersistentMenu('tok', validMenu)
    expect(lastRequest?.url).toContain('/persistentmenu')
    expect(lastRequest?.init?.method).toBe('POST')
    const headers = lastRequest?.init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers.Authorization).toBe('Bearer tok')
  })

  test('成功 (201) はパースした menu を返す', async () => {
    installFetch(() => new Response(JSON.stringify(validMenu), { status: 201 }))
    const result = await setPersistentMenu('tok', validMenu)
    expect(result).toEqual(validMenu)
  })

  test('成功で body が空でも fallback として送信した menu を返す', async () => {
    installFetch(() => new Response('', { status: 201 }))
    const result = await setPersistentMenu('tok', validMenu)
    expect(result).toEqual(validMenu)
  })

  test('upstream 4xx は LineWorksApiError を throw', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    await expect(setPersistentMenu('tok', validMenu)).rejects.toThrow('status=400')
  })

  test('upstream 5xx も LineWorksApiError を throw', async () => {
    installFetch(() => new Response('boom', { status: 503 }))
    await expect(setPersistentMenu('tok', validMenu)).rejects.toThrow('status=503')
  })
})

describe('getPersistentMenu', () => {
  test('GET /bots/{botId}/persistentmenu を叩く', async () => {
    installFetch(() => new Response(JSON.stringify(validMenu), { status: 200 }))
    await getPersistentMenu('tok')
    expect(lastRequest?.init?.method).toBe('GET')
  })

  test('200 OK で menu を返す', async () => {
    installFetch(() => new Response(JSON.stringify(validMenu), { status: 200 }))
    const result = await getPersistentMenu('tok')
    expect(result).toEqual(validMenu)
  })

  test('404 は null を返す (未登録扱い)', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const result = await getPersistentMenu('tok')
    expect(result).toBeNull()
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(getPersistentMenu('tok')).rejects.toThrow('status=500')
  })
})

describe('deletePersistentMenu', () => {
  test('DELETE /bots/{botId}/persistentmenu を叩く', async () => {
    installFetch(() => new Response('', { status: 204 }))
    await deletePersistentMenu('tok')
    expect(lastRequest?.init?.method).toBe('DELETE')
  })

  test('204 No Content は成功扱い', async () => {
    installFetch(() => new Response('', { status: 204 }))
    await expect(deletePersistentMenu('tok')).resolves.toBeUndefined()
  })

  test('404 は idempotent に成功扱い (no-op)', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    await expect(deletePersistentMenu('tok')).resolves.toBeUndefined()
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(deletePersistentMenu('tok')).rejects.toThrow('status=500')
  })
})
