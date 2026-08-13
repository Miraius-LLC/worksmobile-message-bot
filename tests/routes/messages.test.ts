import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { messagesApp } from '@/routes/messages'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

// HTTP boundary を Hono の `app.request(new Request(...))` 経由で踏む feature テスト。
// tokenMiddleware → 実 getServerToken → 実 sendBotMessage まで通し、fetch だけ stub する

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'

let originalFetch: typeof globalThis.fetch
type FetchCall = { url: string; init?: RequestInit }
let calls: FetchCall[]

function installFetch() {
  calls = []
  const spy = mock(async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, init })
    if (u.includes(AUTH_HOST)) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 86_400 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (u.includes(API_HOST)) {
      return new Response('', { status: 200 })
    }
    return new Response('unmocked', { status: 500 })
  })
  globalThis.fetch = spy as unknown as typeof globalThis.fetch
  return spy
}

beforeEach(() => {
  originalFetch = globalThis.fetch
  _resetTokenCacheForTest()
  installFetch()
})
afterEach(() => {
  globalThis.fetch = originalFetch
  _resetTokenCacheForTest()
})

function postJson(path: string, body: unknown) {
  return messagesApp.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function findApiCall(): FetchCall | undefined {
  return calls.find(c => c.url.includes(API_HOST))
}

describe('routes/messages: Hono integration', () => {
  test('POST /channels/:id/messages/type/text → 201 + channels URL', async () => {
    const res = await postJson('/channels/C1/messages/type/text', { text: 'hi' })
    expect(res.status).toBe(201)
    expect(await res.text()).toBe('')
    const apiCall = findApiCall()
    expect(apiCall?.url).toContain('/channels/C1/messages')
    const sent = JSON.parse((apiCall?.init?.body as string) ?? '{}')
    expect(sent).toEqual({ content: { type: 'text', text: 'hi' } })
  })

  test('POST /users/:id/messages/type/text → users URL に変わる', async () => {
    const res = await postJson('/users/U1/messages/type/text', { text: 'hello' })
    expect(res.status).toBe(201)
    expect(await res.text()).toBe('')
    expect(findApiCall()?.url).toContain('/users/U1/messages')
  })

  test('Authorization ヘッダに getServerToken の結果が乗る', async () => {
    await postJson('/channels/C1/messages/type/text', { text: 'hi' })
    const headers = findApiCall()?.init?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer tok')
  })

  test('空の text body は 400 + 日本語エラーメッセージ', async () => {
    const res = await postJson('/channels/C1/messages/type/text', { text: '' })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('必須')
    // 失敗時は fetch (API 呼び出し) されない
    expect(findApiCall()).toBeUndefined()
  })

  test('未知の type は 404 (ルート登録されていない)', async () => {
    const res = await postJson('/channels/C1/messages/type/unknown_type', {})
    expect(res.status).toBe(404)
  })

  test('flex は altText + contents を要求 → 不足で 400', async () => {
    const res = await postJson('/channels/C1/messages/type/flex', {
      contents: { type: 'bubble' },
    })
    expect(res.status).toBe(400)
  })

  test('flex に altText + contents が揃えば 201', async () => {
    const res = await postJson('/channels/C1/messages/type/flex', {
      altText: 'a',
      contents: { type: 'bubble' },
    })
    expect(res.status).toBe(201)
    expect(await res.text()).toBe('')
    const sent = JSON.parse((findApiCall()?.init?.body as string) ?? '{}')
    expect(sent.content.type).toBe('flex')
    expect(sent.content.altText).toBe('a')
  })

  test('全 messageType で 201 の空 body を返す横断テスト', async () => {
    const messageFixtures: Record<string, unknown> = {
      text: { text: 'test' },
      sticker: { packageId: '1', stickerId: '2' },
      image: { fileId: 'F1' },
      file: { fileId: 'F1' },
      audio: { fileId: 'F1' },
      video: { fileId: 'F1' },
      location: { title: 'T', address: 'A', latitude: 0, longitude: 0 },
      link: { contentText: 'C', linkText: 'L', link: 'https://example.com' },
      button_template: { contentText: 'C', actions: [{ type: 'message', label: 'L' }] },
      list_template: { elements: [{ title: 'T' }] },
      carousel: {
        columns: [{ fileId: 'F1', text: 'T', actions: [{ type: 'message', label: 'L' }] }],
      },
      image_carousel: { columns: [{ fileId: 'F1' }] },
      flex: { altText: 'A', contents: { type: 'bubble' } },
    }

    for (const [type, payload] of Object.entries(messageFixtures)) {
      const res = await postJson(`/channels/C1/messages/type/${type}`, payload)
      expect(res.status).toBe(201)
      expect(await res.text()).toBe('')
    }
  })
})
