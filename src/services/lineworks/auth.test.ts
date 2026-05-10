import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { _resetTokenCacheForTest, getServerToken } from '@/services/lineworks/auth'
import { requireEnv } from '@/test-helpers/utils'

let originalFetch: typeof globalThis.fetch
beforeEach(() => {
  originalFetch = globalThis.fetch
  _resetTokenCacheForTest()
})
afterEach(() => {
  globalThis.fetch = originalFetch
  _resetTokenCacheForTest()
})

function installTokenResponse(token = 'access-token', expiresIn = 86_400) {
  const spy = mock(
    async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  )
  globalThis.fetch = spy as unknown as typeof globalThis.fetch
  return spy
}

describe('services/lineworks/auth', () => {
  test('初回はトークンを fetch してそのまま返す', async () => {
    const fetchSpy = installTokenResponse('first-token')
    expect(await getServerToken()).toBe('first-token')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const call = fetchSpy.mock.calls[0]
    expect(call?.[0]).toBe('https://auth.worksmobile.com/oauth2/v2.0/token')
    const init = call?.[1] as RequestInit | undefined
    expect(init?.method).toBe('POST')
    const body = init?.body
    expect(body).toBeInstanceOf(URLSearchParams)
    const params = body as URLSearchParams
    expect(params.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    expect(params.get('scope')).toBe('bot')
    expect(params.get('client_id')).toBe(requireEnv('CLIENT_ID'))
    // JWT は 3 セクション (header.payload.signature)
    const assertion = params.get('assertion') ?? ''
    expect(assertion.split('.')).toHaveLength(3)
  })

  test('2 回目以降はキャッシュを返し fetch を再呼び出ししない', async () => {
    const fetchSpy = installTokenResponse('cached')
    await getServerToken()
    await getServerToken()
    await getServerToken()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test('並列呼び出しでも fetch は 1 回だけ (single-flight)', async () => {
    let resolveResp: (r: Response) => void = () => {}
    const pending = new Promise<Response>(r => {
      resolveResp = r
    })
    const fetchSpy = mock(async (_url: string | URL, _init?: RequestInit) => pending)
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch

    // 3 本同時に呼んでも全部 inFlight Promise を共有する
    const all = Promise.all([getServerToken(), getServerToken(), getServerToken()])
    resolveResp(
      new Response(JSON.stringify({ access_token: 'parallel', expires_in: 86_400 }), {
        status: 200,
      }),
    )
    const results = await all
    expect(results).toEqual(['parallel', 'parallel', 'parallel'])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test('upstream が非 ok だと throw する', async () => {
    globalThis.fetch = mock(
      async () => new Response('forbidden', { status: 403 }),
    ) as unknown as typeof globalThis.fetch
    expect(getServerToken()).rejects.toThrow(/status=403/)
  })

  test('access_token がレスポンスに含まれない時も throw', async () => {
    globalThis.fetch = mock(
      async () => new Response(JSON.stringify({}), { status: 200 }),
    ) as unknown as typeof globalThis.fetch
    expect(getServerToken()).rejects.toThrow(/アクセストークン/)
  })
})
