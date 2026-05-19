import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { app } from '@/app'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'
const BASIC_AUTH = `Basic ${Buffer.from('test-user:test-pass').toString('base64')}`

type Recorded = { url: string; init?: RequestInit }
let originalFetch: typeof globalThis.fetch
let recorded: Recorded[] = []

function installFetch(apiResponse: (url: string) => Response) {
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
      return apiResponse(u)
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

describe('POST /domains/:domainId/members (登録)', () => {
  test('正常 body は 201 + userId', async () => {
    installFetch(() => new Response('', { status: 201 }))
    const res = await app.request('/domains/400376434/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ userId: 'u1' }),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ userId: 'u1' })
    const apiCall = recorded.find(r => r.url.includes('/domains/400376434/members'))
    expect(apiCall?.init?.method).toBe('POST')
  })

  test('userId 欠落は 400 (zValidator)', async () => {
    const res = await app.request('/domains/400376434/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/domains/400376434/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'u1' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /domains/:domainId/members (一覧)', () => {
  test('200 + members 配列を返す', async () => {
    installFetch(() => new Response(JSON.stringify({ members: ['u1', 'u2'] }), { status: 200 }))
    const res = await app.request('/domains/400376434/members', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { members: string[] }
    expect(body.members).toEqual(['u1', 'u2'])
  })

  test('count / cursor query が upstream URL に反映される', async () => {
    installFetch(() => new Response(JSON.stringify({ members: [] }), { status: 200 }))
    await app.request('/domains/400376434/members?count=20&cursor=abc', {
      headers: { Authorization: BASIC_AUTH },
    })
    const apiCall = recorded.find(r => r.url.includes('/domains/400376434/members'))
    expect(apiCall?.url).toContain('count=20')
    expect(apiCall?.url).toContain('cursor=abc')
  })

  test('count 範囲外は 400 (zValidator)', async () => {
    const res = await app.request('/domains/400376434/members?count=999', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/domains/400376434/members')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /domains/:domainId/members/:userId (削除)', () => {
  test('正常 204', async () => {
    installFetch(() => new Response('', { status: 204 }))
    const res = await app.request('/domains/400376434/members/u1', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
    const apiCall = recorded.find(r => r.url.includes('/domains/400376434/members/u1'))
    expect(apiCall?.init?.method).toBe('DELETE')
  })

  test('upstream 404 も 204 idempotent', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const res = await app.request('/domains/400376434/members/u1', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/domains/400376434/members/u1', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })
})
