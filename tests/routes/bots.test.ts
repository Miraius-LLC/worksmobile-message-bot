import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { app } from '@/app'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'
const BASIC_AUTH = `Basic ${Buffer.from('test-user:test-pass').toString('base64')}`

const validBot = {
  botName: 'SUMIRE Group',
  photoUrl: 'https://example.com/photo.png',
  description: '職員通知 Bot',
  administrators: ['admin-user-id'],
}

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

describe('POST /bots (作成)', () => {
  test('正常 body は 201 + botInfo', async () => {
    installFetch(
      () => new Response(JSON.stringify({ botId: 'b-001', ...validBot }), { status: 201 }),
    )
    const res = await app.request('/bots', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(validBot),
    })
    expect(res.status).toBe(201)
    expect(((await res.json()) as { botId: string }).botId).toBe('b-001')
  })

  test('photoUrl が HTTP は 400 (zValidator)', async () => {
    const bad = { ...validBot, photoUrl: 'http://example.com/p.png' }
    const res = await app.request('/bots', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(bad),
    })
    expect(res.status).toBe(400)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/bots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBot),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /bots (一覧)', () => {
  test('200 + { bots: [...] } を返す', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify({ bots: [{ botId: 'b-001', ...validBot }] }), {
          status: 200,
        }),
    )
    const res = await app.request('/bots', { headers: { Authorization: BASIC_AUTH } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { bots: Array<{ botId: string }> }
    expect(body.bots[0]?.botId).toBe('b-001')
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/bots')
    expect(res.status).toBe(401)
  })
})

describe('GET /bots/:botId', () => {
  test('200 + info を返す', async () => {
    installFetch(
      () => new Response(JSON.stringify({ botId: 'b-001', ...validBot }), { status: 200 }),
    )
    const res = await app.request('/bots/b-001', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
  })

  test('未登録は 200 + null', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const res = await app.request('/bots/b-999', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })
})

describe('PUT /bots/:botId (完全置換)', () => {
  test('正常 body は 200 + info', async () => {
    installFetch(
      () => new Response(JSON.stringify({ botId: 'b-001', ...validBot }), { status: 200 }),
    )
    const res = await app.request('/bots/b-001', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(validBot),
    })
    expect(res.status).toBe(200)
    const apiCall = recorded.find(r => r.url.includes('/bots/b-001'))
    expect(apiCall?.init?.method).toBe('PUT')
  })

  test('photoUrl が HTTP は 400', async () => {
    const bad = { ...validBot, photoUrl: 'http://example.com/p.png' }
    const res = await app.request('/bots/b-001', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify(bad),
    })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /bots/:botId (部分更新)', () => {
  test('一部フィールドだけで 200', async () => {
    installFetch(
      () => new Response(JSON.stringify({ botId: 'b-001', ...validBot }), { status: 200 }),
    )
    const res = await app.request('/bots/b-001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ botName: 'Renamed' }),
    })
    expect(res.status).toBe(200)
    const apiCall = recorded.find(r => r.url.includes('/bots/b-001'))
    expect(apiCall?.init?.method).toBe('PATCH')
  })

  test('photoUrl が HTTP は 400 (partial 中でも HTTPS チェックは効く)', async () => {
    const res = await app.request('/bots/b-001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', Authorization: BASIC_AUTH },
      body: JSON.stringify({ photoUrl: 'http://example.com/p.png' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /bots/:botId', () => {
  test('正常 204', async () => {
    installFetch(() => new Response('', { status: 204 }))
    const res = await app.request('/bots/b-001', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
  })

  test('upstream 404 も 204 idempotent', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const res = await app.request('/bots/b-001', {
      method: 'DELETE',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(204)
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/bots/b-001', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })
})

describe('POST /bots/:botId/secret (再発行)', () => {
  test('200 + 新 botSecret を返す', async () => {
    installFetch(
      () => new Response(JSON.stringify({ botSecret: 'new-secret-001' }), { status: 200 }),
    )
    const res = await app.request('/bots/b-001/secret', {
      method: 'POST',
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ botSecret: 'new-secret-001' })
    const apiCall = recorded.find(r => r.url.includes('/secret'))
    expect(apiCall?.init?.method).toBe('POST')
  })

  test('BASIC 認証なしは 401', async () => {
    const res = await app.request('/bots/b-001/secret', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})

// =============================================================================
// 本番 BOT 自己破壊 403 ガード (test-helpers/setup.ts で BOT_ID='test-bot-id' 固定)
// =============================================================================

describe('本番 BOT 自己破壊 403 ガード', () => {
  // setup.ts で process.env.BOT_ID = 'test-bot-id'。これと一致する :botId が「本番」扱い
  const PROD_BOT_ID = 'test-bot-id'

  describe('DELETE /bots/:botId', () => {
    test('本番 BOT_ID + confirm 無し → 403', async () => {
      installFetch(() => new Response('', { status: 204 }))
      const res = await app.request(`/bots/${PROD_BOT_ID}`, {
        method: 'DELETE',
        headers: { Authorization: BASIC_AUTH },
      })
      expect(res.status).toBe(403)
      const body = (await res.json()) as { error: string; botId: string }
      expect(body.error).toContain('?confirm=')
      expect(body.botId).toBe(PROD_BOT_ID)
      // upstream は叩かれていない
      expect(recorded.some(r => r.url.includes('/www.worksapis.com'))).toBe(false)
    })

    test('本番 BOT_ID + confirm 一致 → 204 (通す)', async () => {
      installFetch(() => new Response('', { status: 204 }))
      const res = await app.request(`/bots/${PROD_BOT_ID}?confirm=${PROD_BOT_ID}`, {
        method: 'DELETE',
        headers: { Authorization: BASIC_AUTH },
      })
      expect(res.status).toBe(204)
    })

    test('本番 BOT_ID + confirm 別値 → 403', async () => {
      const res = await app.request(`/bots/${PROD_BOT_ID}?confirm=wrong-value`, {
        method: 'DELETE',
        headers: { Authorization: BASIC_AUTH },
      })
      expect(res.status).toBe(403)
    })

    test('本番 BOT_ID と異なる id は confirm 不要で 204', async () => {
      installFetch(() => new Response('', { status: 204 }))
      const res = await app.request('/bots/some-other-bot-id', {
        method: 'DELETE',
        headers: { Authorization: BASIC_AUTH },
      })
      expect(res.status).toBe(204)
    })
  })

  describe('POST /bots/:botId/secret', () => {
    test('本番 BOT_ID + confirm 無し → 403', async () => {
      installFetch(() => new Response(JSON.stringify({ botSecret: 'x' }), { status: 200 }))
      const res = await app.request(`/bots/${PROD_BOT_ID}/secret`, {
        method: 'POST',
        headers: { Authorization: BASIC_AUTH },
      })
      expect(res.status).toBe(403)
      const body = (await res.json()) as { error: string }
      expect(body.error).toContain('Secret Manager')
      // upstream は叩かれていない
      expect(recorded.some(r => r.url.includes('/secret'))).toBe(false)
    })

    test('本番 BOT_ID + confirm 一致 → 200 (通す)', async () => {
      installFetch(() => new Response(JSON.stringify({ botSecret: 'new-x' }), { status: 200 }))
      const res = await app.request(`/bots/${PROD_BOT_ID}/secret?confirm=${PROD_BOT_ID}`, {
        method: 'POST',
        headers: { Authorization: BASIC_AUTH },
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ botSecret: 'new-x' })
    })

    test('本番 BOT_ID と異なる id は confirm 不要で 200', async () => {
      installFetch(() => new Response(JSON.stringify({ botSecret: 'x' }), { status: 200 }))
      const res = await app.request('/bots/some-other-bot-id/secret', {
        method: 'POST',
        headers: { Authorization: BASIC_AUTH },
      })
      expect(res.status).toBe(200)
    })
  })
})
