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
  test('正常 body は 201 + richmenuId', async () => {
    installFetch(() => new Response(JSON.stringify({ richmenuId: 'rm-001' }), { status: 201 }))
    const res = await app.request('/menus/rich', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(sampleMenu),
    })
    expect(res.status).toBe(201)
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

  test('count/cursor クエリを転送し 200 + responseMetaData を返す', async () => {
    installFetch(
      () =>
        new Response(
          JSON.stringify({
            richmenus: [{ richmenuId: 'rm-001', ...sampleMenu }],
            responseMetaData: { nextCursor: 'rm-next-cur' },
          }),
          { status: 200 },
        ),
    )
    const res = await app.request('/menus/rich?count=15&cursor=rm-cur-0', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      richmenus: Array<{ richmenuId: string }>
      responseMetaData?: { nextCursor?: string }
    }
    expect(body.richmenus).toHaveLength(1)
    expect(body.richmenus[0]?.richmenuId).toBe('rm-001')
    expect(body.responseMetaData?.nextCursor).toBe('rm-next-cur')
    const apiCall = recorded.find(r => r.url.includes('/richmenus'))
    expect(apiCall?.url).toContain('count=15')
    expect(apiCall?.url).toContain('cursor=rm-cur-0')
  })

  test('count が範囲外 (0 や 101) は 400 エラーになる', async () => {
    const resMin = await app.request('/menus/rich?count=0', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(resMin.status).toBe(400)

    const resMax = await app.request('/menus/rich?count=101', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(resMax.status).toBe(400)
  })

  test('空の count は未指定として扱う', async () => {
    installFetch(() => new Response(JSON.stringify({ richmenus: [] }), { status: 200 }))
    const res = await app.request('/menus/rich?count=', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    const apiCall = recorded.find(r => r.url.includes('/richmenus'))
    expect(apiCall?.url).not.toContain('count=')
  })
})

describe('POST /menus/rich/:id/image (画像登録)', () => {
  test('正常は 204 No Content + fileId JSON', async () => {
    installFetch(() => new Response(null, { status: 204 }))
    const res = await app.request('/menus/rich/rm-001/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({
        fileId: 'file-001',
        i18nFileIds: [{ language: 'en_US', fileId: 'file-en-001' }],
      }),
    })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    const apiCall = recorded.find(r => r.url.includes('/richmenus/rm-001/image'))
    expect(apiCall?.init?.method).toBe('POST')
    expect(apiCall?.init?.body).toBe(
      JSON.stringify({
        fileId: 'file-001',
        i18nFileIds: [{ language: 'en_US', fileId: 'file-en-001' }],
      }),
    )
  })

  test('fileId 欠落は 400', async () => {
    const res = await app.request('/menus/rich/rm-001/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test('i18nFileIds の言語コード不正は 400', async () => {
    const res = await app.request('/menus/rich/rm-001/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({
        fileId: 'file-001',
        i18nFileIds: [{ language: 'xx_XX', fileId: 'file-xx-001' }],
      }),
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/rm-001/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileId: 'file-001' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('POST /menus/rich/:id/set-default', () => {
  test('正常終了は 201 + { botId: 12345, defaultRichmenuId: "rm-001" } を透過する', async () => {
    const expectedBody = { botId: 12345, defaultRichmenuId: 'rm-001' }
    installFetch(() => new Response(JSON.stringify(expectedBody), { status: 201 }))
    const res = await app.request('/menus/rich/rm-001/set-default', {
      method: 'POST',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(expectedBody)
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

describe('GET /menus/rich/:id (詳細取得)', () => {
  test('正常は 200 + リッチメニュー詳細', async () => {
    const detail = { richmenuId: 'rm-001', ...sampleMenu, fileId: 'file-001' }
    installFetch(() => new Response(JSON.stringify(detail), { status: 200 }))
    const res = await app.request('/menus/rich/rm-001', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(detail)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/rm-001'))
    expect(apiCall?.init?.method).toBe('GET')
    expect(apiCall?.init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  test('path encoding が正しく適用される', async () => {
    installFetch(
      () => new Response(JSON.stringify({ richmenuId: 'rm/001', ...sampleMenu }), { status: 200 }),
    )
    const res = await app.request('/menus/rich/rm%2F001', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/rm%2F001'))
    expect(apiCall).toBeDefined()
  })

  test('upstream 404 は透過', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const res = await app.request('/menus/rich/rm-001', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(404)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/rm-001')
    expect(res.status).toBe(401)
  })
})

describe('GET /menus/rich/:id/image (画像情報取得)', () => {
  test('正常は 200 + fileId と i18nFileIds を返す', async () => {
    const imageData = {
      fileId: 'file-001',
      i18nFileIds: [{ language: 'en_US', fileId: 'file-en-001' }],
    }
    installFetch(() => new Response(JSON.stringify(imageData), { status: 200 }))
    const res = await app.request('/menus/rich/rm-001/image', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(imageData)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/rm-001/image'))
    expect(apiCall?.init?.method).toBe('GET')
    expect(apiCall?.init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/rm-001/image')
    expect(res.status).toBe(401)
  })
})

describe('POST /menus/rich/:id/users/:userId (ユーザー設定)', () => {
  test('正常は 204 No Content', async () => {
    installFetch(() => new Response(null, { status: 204 }))
    const res = await app.request('/menus/rich/rm-001/users/user-123', {
      method: 'POST',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    const apiCall = recorded.find(r => r.url.includes('/richmenus/rm-001/users/user-123'))
    expect(apiCall?.init?.method).toBe('POST')
    expect(apiCall?.init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  test('path encoding (richmenuId / userId) が適用される', async () => {
    installFetch(() => new Response(null, { status: 204 }))
    const res = await app.request('/menus/rich/rm%2F001/users/user%2F123', {
      method: 'POST',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/rm%2F001/users/user%2F123'))
    expect(apiCall).toBeDefined()
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/rm-001/users/user-123', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})

describe('GET /menus/rich/users/:userId (ユーザーのリッチメニュー取得)', () => {
  test('正常は 200 + リッチメニュー詳細', async () => {
    const detail = { richmenuId: 'rm-001', ...sampleMenu }
    installFetch(() => new Response(JSON.stringify(detail), { status: 200 }))
    const res = await app.request('/menus/rich/users/user-123', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(detail)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/users/user-123'))
    expect(apiCall?.init?.method).toBe('GET')
    expect(apiCall?.init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  test('path encoding (userId) が適用される', async () => {
    const detail = { richmenuId: 'rm-001', ...sampleMenu }
    installFetch(() => new Response(JSON.stringify(detail), { status: 200 }))
    const res = await app.request('/menus/rich/users/user%2F123', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/users/user%2F123'))
    expect(apiCall).toBeDefined()
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/users/user-123')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /menus/rich/users/:userId (ユーザーのリッチメニュー解除)', () => {
  test('正常は 204 No Content', async () => {
    installFetch(() => new Response(null, { status: 204 }))
    const res = await app.request('/menus/rich/users/user-123', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/users/user-123'))
    expect(apiCall?.init?.method).toBe('DELETE')
    expect(apiCall?.init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/users/user-123', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })
})

describe('GET /menus/rich/default (デフォルトリッチメニュー取得)', () => {
  test('正常は 200 + botId & defaultRichmenuId', async () => {
    const result = { botId: 'bot-123', defaultRichmenuId: 'rm-001' }
    installFetch(() => new Response(JSON.stringify(result), { status: 200 }))
    const res = await app.request('/menus/rich/default', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(result)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/default'))
    expect(apiCall?.init?.method).toBe('GET')
    expect(apiCall?.init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/default')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /menus/rich/default (デフォルトリッチメニュー解除)', () => {
  test('正常は 204 No Content', async () => {
    installFetch(() => new Response(null, { status: 204 }))
    const res = await app.request('/menus/rich/default', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
    const apiCall = recorded.find(r => r.url.includes('/richmenus/default'))
    expect(apiCall?.init?.method).toBe('DELETE')
    expect(apiCall?.init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/menus/rich/default', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })
})
