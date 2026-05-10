import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'
import { _resetTokenCacheForTest, getServerToken } from '@/services/lineworks/auth'
import { requireEnv } from '@/test-helpers/utils'

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const [, payload] = jwt.split('.')
  if (!payload) throw new Error('JWT payload missing')
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as Record<string, unknown>
}

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

describe('services/lineworks/auth: JWT payload', () => {
  test('aud / iss / sub / iat / exp が仕様通りに組まれる', async () => {
    // 時刻を固定して iat / exp を deterministic にする
    setSystemTime(new Date('2026-05-11T00:00:00Z'))
    try {
      const fetchSpy = installTokenResponse('t')
      await getServerToken()
      const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
      const params = init?.body as URLSearchParams
      const assertion = params.get('assertion') ?? ''
      const payload = decodeJwtPayload(assertion)

      // CLAUDE.md MUST: aud は LINE WORKS OAuth エンドポイント自体で固定
      expect(payload['aud']).toBe('https://auth.worksmobile.com/oauth2/v2.0/token')
      expect(payload['iss']).toBe(requireEnv('CLIENT_ID'))
      expect(payload['sub']).toBe(requireEnv('SERVICE_ACCOUNT'))

      const iat = payload['iat'] as number
      const exp = payload['exp'] as number
      const expectedIat = Math.floor(new Date('2026-05-11T00:00:00Z').getTime() / 1000)
      expect(iat).toBe(expectedIat)
      // exp は iat + 1 時間
      expect(exp - iat).toBe(60 * 60)
    } finally {
      setSystemTime()
    }
  })

  test('JWT header は alg=RS256, typ=JWT', async () => {
    const fetchSpy = installTokenResponse('t')
    await getServerToken()
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
    const params = init?.body as URLSearchParams
    const [headerSection] = (params.get('assertion') ?? '').split('.')
    const header = JSON.parse(Buffer.from(headerSection ?? '', 'base64url').toString('utf-8'))
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' })
  })
})

describe('services/lineworks/auth: キャッシュ境界', () => {
  test('TTL を越えると再 fetch される', async () => {
    const t0 = new Date('2026-05-11T00:00:00Z')
    setSystemTime(t0)
    try {
      const fetchSpy = installTokenResponse('first', 100)
      expect(await getServerToken()).toBe('first')
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // expires_in=100 + REFRESH_MARGIN_SEC=60 → 41 秒進めば margin 越え扱いで再 fetch
      setSystemTime(new Date(t0.getTime() + 41_000))
      const fetchSpy2 = installTokenResponse('second', 100)
      expect(await getServerToken()).toBe('second')
      expect(fetchSpy2).toHaveBeenCalledTimes(1)
    } finally {
      setSystemTime()
    }
  })

  test('REFRESH_MARGIN_SEC=60 の境界手前ではキャッシュを返す', async () => {
    const t0 = new Date('2026-05-11T00:00:00Z')
    setSystemTime(t0)
    try {
      const fetchSpy = installTokenResponse('cached', 100)
      await getServerToken()

      // expires_in=100, margin=60 → 39 秒 (= 100 - 60 - 1) 経過時点では fresh
      setSystemTime(new Date(t0.getTime() + 39_000))
      await getServerToken()
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    } finally {
      setSystemTime()
    }
  })

  test('single-flight: 取得失敗の次の呼び出しで新しい fetch が立つ (inFlight が null に戻る)', async () => {
    let n = 0
    const fetchSpy = mock(async () => {
      n += 1
      if (n === 1) return new Response('boom', { status: 500 })
      return new Response(JSON.stringify({ access_token: 'after-recovery', expires_in: 86_400 }), {
        status: 200,
      })
    })
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch

    await expect(getServerToken()).rejects.toThrow(/status=500/)
    // 1 回目失敗で inFlight が null に戻っていれば、2 回目で新しい fetch が立つ
    expect(await getServerToken()).toBe('after-recovery')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
