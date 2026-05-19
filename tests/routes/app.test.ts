import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { app } from '@/app'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

// root Hono アプリを `app.request(new Request(...))` で叩く feature テスト。
// `messagesApp` を経由した LineWorksApiError 透過 / 共通の onError / notFound /
// /healthz (+ 互換の /health / /readyz / /livez) / / smoke / secureHeaders を担保する。

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'

// setup.ts でフィクスチャ env として固定済 (BASIC_ID=test-user / BASIC_PASS=test-pass)
const BASIC_AUTH = `Basic ${Buffer.from('test-user:test-pass').toString('base64')}`

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

  test.each([
    '/healthz',
    '/health',
    '/readyz',
    '/livez',
  ])('GET %s → 200 + { status: "ok" }', async path => {
    const res = await app.request(path)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  test('secureHeaders ミドルウェアが X-Frame-Options を付ける', async () => {
    const res = await app.request('/healthz')
    expect(res.headers.get('x-frame-options')).toBeTruthy()
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('app: notFound', () => {
  test('未定義パスは認証付きなら 404 + { error: "Not Found", path }', async () => {
    const res = await app.request('/nope/zzz', { headers: { Authorization: BASIC_AUTH } })
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string; path: string }
    expect(body.error).toBe('Not Found')
    expect(body.path).toContain('/nope/zzz')
  })
})

describe('app: BASIC 認証', () => {
  test('/ は認証なしで 200 (Cloud Run 用の root probe)', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
  })

  test.each([
    '/healthz',
    '/health',
    '/readyz',
    '/livez',
  ])('%s は認証なしで 200 (Docker HEALTHCHECK / liveness / readiness 用)', async path => {
    const res = await app.request(path)
    expect(res.status).toBe(200)
  })

  test('webhook ルートは Authorization 無しだと 401 + WWW-Authenticate', async () => {
    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('Basic')
  })

  test('正しい credentials なら通って 200 (LINE WORKS 送信まで完走)', async () => {
    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(200)
  })

  test('間違った password は 401', async () => {
    const wrong = `Basic ${Buffer.from('test-user:wrong-pass').toString('base64')}`
    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: wrong },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(401)
  })

  test('未知の username は 401', async () => {
    const wrong = `Basic ${Buffer.from('attacker:test-pass').toString('base64')}`
    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: wrong },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(401)
  })

  test('未定義パスでも認証無しなら 401 (path 存在を漏らさない)', async () => {
    const res = await app.request('/nope/zzz')
    expect(res.status).toBe(401)
  })

  test('/attachments も認証必須', async () => {
    const res = await app.request('/attachments/F-abc')
    expect(res.status).toBe(401)
  })
})

describe('app: onError', () => {
  test('LineWorksApiError は upstream の status をそのまま透過する (4xx)', async () => {
    installFetch(() => new Response('upstream not found', { status: 404 }))
    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
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
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(503)
  })

  test('LineWorksApiError レスポンスに code + hint を含める (Bot ダッシュボード設定漏れの切り分け用)', async () => {
    const upstreamBody = JSON.stringify({
      code: 'ACCESS_DENIED',
      description: 'Bot was removed from channel',
    })
    installFetch(() => new Response(upstreamBody, { status: 403 }))
    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string; code?: string; hint?: string }
    expect(body.code).toBe('ACCESS_DENIED')
    expect(body.hint).toContain('Bot ポリシー')
    expect(body.error).toContain('code=ACCESS_DENIED')
  })

  test('upstream が code を返さない 5xx エラーは code/hint なしのレスポンス', async () => {
    installFetch(() => new Response('upstream boom', { status: 503 }))
    const res = await app.request('/channels/C1/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(503)
    const body = (await res.json()) as { error: string; code?: string; hint?: string }
    expect(body.code).toBeUndefined()
    expect(body.hint).toBeUndefined()
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
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('アクセストークン')
  })
})
