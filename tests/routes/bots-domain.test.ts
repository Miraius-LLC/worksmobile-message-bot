import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { app } from '@/app'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

// botsApp の domain 系 5 ルートの feature test。
// 既存 tenant 系の bots.test.ts と分離 (path が深くなるため独立ファイル)

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

describe('GET /bots/:botId/domains', () => {
  test('200 + { domains: [...] }', async () => {
    installFetch(() => new Response(JSON.stringify({ domains: ['d-001'] }), { status: 200 }))
    const res = await app.request('/bots/b-001/domains', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { domains: unknown[] }
    expect(body.domains).toEqual(['d-001'])
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/bots/b-001/domains')
    expect(res.status).toBe(401)
  })
})

describe('POST /bots/:botId/domains/:domainId (登録)', () => {
  test('正常 body は 201 + { botId, domainId }', async () => {
    installFetch(() => new Response('', { status: 201 }))
    const res = await app.request('/bots/b-001/domains/d-001', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ administrators: ['a'] }),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ botId: 'b-001', domainId: 'd-001' })
  })

  test('administrators 欠落は 400', async () => {
    const res = await app.request('/bots/b-001/domains/d-001', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/bots/b-001/domains/d-001', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ administrators: ['a'] }),
    })
    expect(res.status).toBe(401)
  })
})

describe('PUT /bots/:botId/domains/:domainId (完全置換)', () => {
  test('正常 body は 200', async () => {
    installFetch(() => new Response('', { status: 200 }))
    const res = await app.request('/bots/b-001/domains/d-001', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ administrators: ['a'] }),
    })
    expect(res.status).toBe(200)
    const apiCall = recorded.find(r => r.url.includes('/domains/d-001'))
    expect(apiCall?.init?.method).toBe('PUT')
  })
})

describe('PATCH /bots/:botId/domains/:domainId (部分更新)', () => {
  test('一部フィールドだけで 200', async () => {
    installFetch(() => new Response('', { status: 200 }))
    const res = await app.request('/bots/b-001/domains/d-001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ enableCallback: true }),
    })
    expect(res.status).toBe(200)
    const apiCall = recorded.find(r => r.url.includes('/domains/d-001'))
    expect(apiCall?.init?.method).toBe('PATCH')
  })
})

describe('DELETE /bots/:botId/domains/:domainId', () => {
  test('正常 204', async () => {
    installFetch(() => new Response('', { status: 204 }))
    const res = await app.request('/bots/b-001/domains/d-001', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
  })

  test('upstream 404 も 204 idempotent', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const res = await app.request('/bots/b-001/domains/d-001', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/bots/b-001/domains/d-001', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })
})
