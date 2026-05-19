import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { app } from '@/app'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

// /channels (Phase 4) と /channels/:id/messages/type/<X> (Phase 0) が共存することを feature test で確認する。
// Hono は method + path で厳密に判定するので衝突しないはず。

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'
const BASIC_AUTH = `Basic ${Buffer.from('test-user:test-pass').toString('base64')}`

type Recorded = { url: string; init?: RequestInit }
let originalFetch: typeof globalThis.fetch
let recorded: Recorded[] = []

function installFetch(apiResponse: (url: string, init?: RequestInit) => Response) {
  recorded = []
  globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    recorded.push({ url: u, init })
    if (u.includes(AUTH_HOST)) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 86_400 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (u.includes(API_HOST)) {
      return apiResponse(u, init)
    }
    return new Response('unmocked', { status: 500 })
  }) as unknown as typeof globalThis.fetch
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

describe('POST /channels (作成)', () => {
  test('正常 body は 200 + channelId', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify({ channelId: 'ch-001', title: 'test' }), {
          status: 201,
        }),
    )
    const res = await app.request('/channels', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ members: ['u1'], title: 'test' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ channelId: 'ch-001', title: 'test' })
  })

  test('members 重複は 400 (zValidator)', async () => {
    const res = await app.request('/channels', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ members: ['u1', 'u1'] }),
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/channels', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ members: ['u1'] }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /channels/:id (情報取得)', () => {
  const info = {
    domainId: 1,
    channelId: 'ch-001',
    title: 'sample',
    channelType: { type: 'MULTI_USERS' },
  }

  test('200 + info を返す', async () => {
    installFetch(() => new Response(JSON.stringify(info), { status: 200 }))
    const res = await app.request('/channels/ch-001', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(info)
  })

  test('未登録 (upstream 404) は 200 + null', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const res = await app.request('/channels/ch-999', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/channels/ch-001')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /channels/:id (退室)', () => {
  test('正常 204', async () => {
    installFetch(() => new Response('', { status: 204 }))
    const res = await app.request('/channels/ch-001', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
    const apiCall = recorded.find(r => r.url.includes('/channels/ch-001'))
    expect(apiCall?.init?.method).toBe('DELETE')
  })

  test('upstream 404 も 204 idempotent', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const res = await app.request('/channels/ch-001', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/channels/ch-001', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })
})

describe('GET /channels/:id/members (メンバー一覧)', () => {
  test('200 + members 配列を返す', async () => {
    installFetch(() => new Response(JSON.stringify({ members: ['u1', 'u2'] }), { status: 200 }))
    const res = await app.request('/channels/ch-001/members', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { members: string[] }
    expect(body.members).toEqual(['u1', 'u2'])
  })

  test('count / cursor query が upstream URL に反映される', async () => {
    installFetch(() => new Response(JSON.stringify({ members: [] }), { status: 200 }))
    await app.request('/channels/ch-001/members?count=10&cursor=abc', {
      headers: { Authorization: BASIC_AUTH },
    })
    const apiCall = recorded.find(r => r.url.includes('/members'))
    expect(apiCall?.url).toContain('count=10')
    expect(apiCall?.url).toContain('cursor=abc')
  })

  test('count 範囲外は 400 (zValidator)', async () => {
    const res = await app.request('/channels/ch-001/members?count=200', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/channels/ch-001/members')
    expect(res.status).toBe(401)
  })
})

describe('既存 messages routes との path 共存', () => {
  test('POST /channels/:id/messages/type/text は messagesApp 経由で 200 (Phase 4 と path 衝突なし)', async () => {
    installFetch(() => new Response('', { status: 200 }))
    const res = await app.request('/channels/ch-001/messages/type/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(200)
  })

  test('GET /channels/:id は channelsApp 経由で動く (POST / と方法違い)', async () => {
    installFetch(
      () =>
        new Response(
          JSON.stringify({
            domainId: 1,
            channelId: 'ch-001',
            channelType: { type: 'MULTI_USERS' },
          }),
          { status: 200 },
        ),
    )
    const res = await app.request('/channels/ch-001', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
  })
})
