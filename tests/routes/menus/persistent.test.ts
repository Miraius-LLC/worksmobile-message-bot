import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { app } from '@/app'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

// /menus/persistent route の feature test。
// LINE WORKS の auth + persistentmenu API を fetch mock で差し替えて、ルート層が
// 期待通り method / status / body を返すかを検証する。

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'
const BASIC_AUTH = `Basic ${Buffer.from('test-user:test-pass').toString('base64')}`

const sampleMenu = {
  content: {
    actions: [{ type: 'message', label: 'hello', text: 'hello' }],
  },
}

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
  installFetch(() => new Response(JSON.stringify(sampleMenu), { status: 200 }))
})
afterEach(() => {
  globalThis.fetch = originalFetch
  _resetTokenCacheForTest()
})

describe('POST /menus/persistent', () => {
  test('正常な body は 200 + menu を返す', async () => {
    installFetch(() => new Response(JSON.stringify(sampleMenu), { status: 201 }))
    const res = await app.request('/menus/persistent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(sampleMenu),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sampleMenu)
    // upstream を POST で叩いたことを確認
    const apiCall = recorded.find(r => r.url.includes('/persistentmenu'))
    expect(apiCall?.init?.method).toBe('POST')
  })

  test('actions 5 件は zValidator で 400', async () => {
    const tooMany = {
      content: {
        actions: Array.from({ length: 5 }, (_, i) => ({
          type: 'message',
          label: `b${i}`,
          text: `t${i}`,
        })),
      },
    }
    const res = await app.request('/menus/persistent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(tooMany),
    })
    expect(res.status).toBe(400)
    expect(recorded.some(r => r.url.includes('/persistentmenu'))).toBe(false)
  })

  test('未知 action.type も zValidator で 400', async () => {
    const res = await app.request('/menus/persistent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ content: { actions: [{ type: 'nope', label: 'x' }] } }),
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/persistent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sampleMenu),
    })
    expect(res.status).toBe(401)
  })

  test('upstream 5xx は status を透過 (LineWorksApiError 経由)', async () => {
    installFetch(() => new Response('boom', { status: 503 }))
    const res = await app.request('/menus/persistent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(sampleMenu),
    })
    expect(res.status).toBe(503)
  })
})

describe('GET /menus/persistent', () => {
  test('登録済みなら 200 + menu', async () => {
    installFetch(() => new Response(JSON.stringify(sampleMenu), { status: 200 }))
    const res = await app.request('/menus/persistent', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sampleMenu)
  })

  test('未登録 (404) なら 200 + null', async () => {
    installFetch(() => new Response('', { status: 404 }))
    const res = await app.request('/menus/persistent', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/persistent')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /menus/persistent', () => {
  test('正常終了は 204', async () => {
    installFetch(() => new Response('', { status: 204 }))
    const res = await app.request('/menus/persistent', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
    const apiCall = recorded.find(r => r.url.includes('/persistentmenu'))
    expect(apiCall?.init?.method).toBe('DELETE')
  })

  test('未登録 (upstream 404) も 204 で idempotent', async () => {
    installFetch(() => new Response('', { status: 404 }))
    const res = await app.request('/menus/persistent', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/persistent', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })
})
