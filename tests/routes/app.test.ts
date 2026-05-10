import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { app } from '@/app'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

// root Hono アプリを `app.request(new Request(...))` で叩く feature テスト。
// `messagesApp` を経由した LineWorksApiError 透過 / 共通の onError / notFound /
// /health / / smoke / secureHeaders を担保する。

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'

let originalFetch: typeof globalThis.fetch
type FetchCall = { url: string; init?: RequestInit }
let calls: FetchCall[]

function installFetch(apiResponse: () => Response) {
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
      return apiResponse()
    }
    return new Response('unmocked', { status: 500 })
  })
  globalThis.fetch = spy as unknown as typeof globalThis.fetch
  return spy
}

beforeEach(() => {
  originalFetch = globalThis.fetch
  _resetTokenCacheForTest()
  installFetch(() => new Response('', { status: 200 }))
})
afterEach(() => {
  globalThis.fetch = originalFetch
  _resetTokenCacheForTest()
})

describe('app: smoke', () => {
  test('GET / → 200 + statusCode/message', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ statusCode: 200, message: 'Server is running' })
  })

  test('GET /health → 200 + { status: "ok" }', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  test('secureHeaders ミドルウェアが X-Frame-Options を付ける', async () => {
    const res = await app.request('/health')
    expect(res.headers.get('x-frame-options')).toBeTruthy()
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('app: notFound', () => {
  test('未定義パスは 404 + { error: "Not Found", path }', async () => {
    const res = await app.request('/nope/zzz')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string; path: string }
    expect(body.error).toBe('Not Found')
    expect(body.path).toContain('/nope/zzz')
  })
})

describe('app: onError', () => {
  test('LineWorksApiError は upstream の status をそのまま透過する (4xx)', async () => {
    installFetch(() => new Response('upstream not found', { status: 404 }))
    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('LINE WORKS')
    expect(body.error).toContain('status=404')
  })

  test('LineWorksApiError は upstream の status をそのまま透過する (5xx)', async () => {
    installFetch(() => new Response('upstream boom', { status: 503 }))
    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(503)
  })

  test('予期しない Error は 500 + { error: message }', async () => {
    // tokenMiddleware の getServerToken が throw する経路を踏む
    installFetch(() => new Response('', { status: 200 }))
    const spy = mock(async (url: string | URL) => {
      const u = String(url)
      if (u.includes(AUTH_HOST)) {
        return new Response('forbidden', { status: 403 })
      }
      return new Response('unmocked', { status: 500 })
    })
    globalThis.fetch = spy as unknown as typeof globalThis.fetch

    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('アクセストークン')
  })
})
