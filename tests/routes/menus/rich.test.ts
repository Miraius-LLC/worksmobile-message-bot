import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { app } from '@/app'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

// /menus/rich route の feature test。auth と richmenus 系を fetch mock で差し替えて
// 5 ルートそれぞれの正常 / Zod 400 / BASIC 認証 / upstream エラー透過を確認する。

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'
const BASIC_AUTH = `Basic ${Buffer.from('test-user:test-pass').toString('base64')}`

const sampleMenu = {
  richmenuName: 'test',
  size: { width: 2500, height: 843 },
  areas: [
    {
      bounds: { x: 0, y: 0, width: 2500, height: 843 },
      action: { type: 'postback', label: 'go', data: 'action=go' },
    },
  ],
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
  installFetch(() => new Response('', { status: 200 }))
})
afterEach(() => {
  globalThis.fetch = originalFetch
  _resetTokenCacheForTest()
})

describe('POST /menus/rich (作成)', () => {
  test('正常 body は 200 + richmenuId', async () => {
    installFetch(() => new Response(JSON.stringify({ richmenuId: 'rm-001' }), { status: 201 }))
    const res = await app.request('/menus/rich', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(sampleMenu),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ richmenuId: 'rm-001' })
    const apiCall = recorded.find(r => r.url.includes('/richmenus'))
    expect(apiCall?.init?.method).toBe('POST')
  })

  test('size.height 不正は 400', async () => {
    const bad = { ...sampleMenu, size: { width: 2500, height: 999 } }
    const res = await app.request('/menus/rich', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(bad),
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sampleMenu),
    })
    expect(res.status).toBe(401)
  })

  test('upstream エラーは透過', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    const res = await app.request('/menus/rich', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(sampleMenu),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /menus/rich (一覧)', () => {
  test('200 + { richmenus: [...] } を返す', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify({ richmenus: [{ richmenuId: 'rm-001', ...sampleMenu }] }), {
          status: 200,
        }),
    )
    const res = await app.request('/menus/rich', { headers: { Authorization: BASIC_AUTH } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { richmenus: Array<{ richmenuId: string }> }
    expect(body.richmenus).toHaveLength(1)
    expect(body.richmenus[0]?.richmenuId).toBe('rm-001')
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich')
    expect(res.status).toBe(401)
  })
})

describe('POST /menus/rich/:id/image (画像登録)', () => {
  function buildFormData(file: Blob, filename = 'menu.png'): FormData {
    const fd = new FormData()
    fd.append('file', file, filename)
    return fd
  }

  test('正常 (PNG) は 200 + richmenuId', async () => {
    installFetch(() => new Response('', { status: 201 }))
    const fd = buildFormData(new Blob(['fake'], { type: 'image/png' }))
    const res = await app.request('/menus/rich/rm-001/image', {
      method: 'POST',
      headers: { Authorization: BASIC_AUTH },
      body: fd,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ richmenuId: 'rm-001' })
    const apiCall = recorded.find(r => r.url.includes('/richmenus/rm-001/image'))
    expect(apiCall?.init?.method).toBe('POST')
  })

  test('file フィールド欠落は 400', async () => {
    const fd = new FormData()
    fd.append('not-file', 'x')
    const res = await app.request('/menus/rich/rm-001/image', {
      method: 'POST',
      headers: { Authorization: BASIC_AUTH },
      body: fd,
    })
    expect(res.status).toBe(400)
  })

  test('未対応 MIME (text/plain) は 400', async () => {
    const fd = buildFormData(new Blob(['x'], { type: 'text/plain' }), 'x.txt')
    const res = await app.request('/menus/rich/rm-001/image', {
      method: 'POST',
      headers: { Authorization: BASIC_AUTH },
      body: fd,
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const fd = buildFormData(new Blob(['x'], { type: 'image/png' }))
    const res = await app.request('/menus/rich/rm-001/image', {
      method: 'POST',
      body: fd,
    })
    expect(res.status).toBe(401)
  })
})

describe('POST /menus/rich/:id/set-default', () => {
  test('正常終了は 200 + richmenuId', async () => {
    installFetch(() => new Response('', { status: 200 }))
    const res = await app.request('/menus/rich/rm-001/set-default', {
      method: 'POST',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ richmenuId: 'rm-001' })
    const apiCall = recorded.find(r => r.url.includes('/set-default'))
    expect(apiCall?.init?.method).toBe('POST')
  })

  test('upstream 404 は透過', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const res = await app.request('/menus/rich/rm-001/set-default', {
      method: 'POST',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(404)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/rm-001/set-default', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /menus/rich/:id', () => {
  test('正常 (204)', async () => {
    installFetch(() => new Response('', { status: 204 }))
    const res = await app.request('/menus/rich/rm-001', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/rm-001'))
    expect(apiCall?.init?.method).toBe('DELETE')
  })

  test('upstream 404 (未登録) も 204 idempotent', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const res = await app.request('/menus/rich/rm-001', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/rm-001', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })
})
