import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { forwardEventToUpstream } from '@/services/lineworks/callback/forward'

// fetchWithTimeout は内部で globalThis.fetch を呼ぶので、global fetch を差し替える
// (= _fetch モジュールを mock.module すると他テストにリークするため、global fetch の
//  差し替え + afterEach 復元のリークしない方式を使う)。
// 転送先URLはsetup.tsがFORWARD_CALLBACK_URLをtest fixture envに設定する。

const RAW_BODY =
  '{"type":"message","source":{"userId":"u1","domainId":1},"content":{"type":"text","text":"/today"}}'
const SIGNATURE = 'dGVzdC1zaWduYXR1cmU='

let originalFetch: typeof fetch
let calls: { url: string; init?: RequestInit }[]

beforeEach(() => {
  originalFetch = globalThis.fetch
  calls = []
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function stubFetch(status: number): void {
  globalThis.fetch = mock(async (input: string | URL, init?: RequestInit) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), init })
    return new Response(status >= 400 ? 'err' : '', { status })
  }) as unknown as typeof fetch
}

describe('forwardEventToUpstream', () => {
  test('upstream URLにraw body + X-WORKS-Signatureをそのまま転送する', async () => {
    stubFetch(200)
    await forwardEventToUpstream(RAW_BODY, SIGNATURE)
    expect(calls.length).toBe(1)
    expect(calls[0]?.url).toBe('https://upstream.example.test/callback')
    expect(calls[0]?.init?.method).toBe('POST')
    expect(calls[0]?.init?.body).toBe(RAW_BODY)
    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('X-WORKS-Signature')).toBe(SIGNATURE)
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  test('2xx は throw しない', async () => {
    stubFetch(200)
    await expect(forwardEventToUpstream(RAW_BODY, SIGNATURE)).resolves.toBeUndefined()
  })

  test('4xx は throw しない (再送ループを防ぐため warn して return)', async () => {
    stubFetch(400)
    await expect(forwardEventToUpstream(RAW_BODY, SIGNATURE)).resolves.toBeUndefined()
    expect(calls.length).toBe(1)
  })

  test('5xx は throw する (upstream 転送失敗を上位へ伝播)', async () => {
    stubFetch(503)
    await expect(forwardEventToUpstream(RAW_BODY, SIGNATURE)).rejects.toThrow(
      'forward to upstream failed: 503',
    )
  })

  test('署名が undefined でも転送する (X-WORKS-Signature ヘッダなし)', async () => {
    stubFetch(200)
    await forwardEventToUpstream(RAW_BODY, undefined)
    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('X-WORKS-Signature')).toBeNull()
  })
})

describe('forwardEventToUpstream: Cloudflare Access の service token', () => {
  // upstream (501) を Access の内側に置くと、token 無しの転送は 403 で弾かれる。
  // 「守っているつもりで素通り」「弾かれたのに 200 を返して callback が消える」の 2 つを潰す。
  // config は load() 済みのキャッシュを配るので、env を入れ替えたら reset → load し直す。
  async function reloadConfig(): Promise<void> {
    const { _resetConfigCacheForTest, load } = await import('@/utils/config')
    _resetConfigCacheForTest()
    load(process.env)
  }

  afterEach(async () => {
    Reflect.deleteProperty(process.env, 'CF_ACCESS_CLIENT_ID')
    Reflect.deleteProperty(process.env, 'CF_ACCESS_CLIENT_SECRET')
    await reloadConfig()
  })

  test('token が設定されていれば CF-Access-* ヘッダを付ける', async () => {
    process.env['CF_ACCESS_CLIENT_ID'] = 'client-id.access'
    process.env['CF_ACCESS_CLIENT_SECRET'] = 'client-secret'
    await reloadConfig()

    stubFetch(200)
    await forwardEventToUpstream(RAW_BODY, SIGNATURE)
    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('CF-Access-Client-Id')).toBe('client-id.access')
    expect(headers.get('CF-Access-Client-Secret')).toBe('client-secret')
    // 署名は従来どおり素通しする
    expect(headers.get('X-WORKS-Signature')).toBe(SIGNATURE)
  })

  test('token 未設定なら CF-Access-* を付けない', async () => {
    stubFetch(200)
    await forwardEventToUpstream(RAW_BODY, SIGNATURE)
    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('CF-Access-Client-Id')).toBeNull()
  })

  test('403 は throw する (黙って 200 を返すと callback が消える)', async () => {
    stubFetch(403)
    expect(forwardEventToUpstream(RAW_BODY, SIGNATURE)).rejects.toThrow(
      /forward to upstream rejected: 403/,
    )
  })

  test('401 も throw する', async () => {
    stubFetch(401)
    expect(forwardEventToUpstream(RAW_BODY, SIGNATURE)).rejects.toThrow(
      /forward to upstream rejected: 401/,
    )
  })

  test('404 は従来どおり warn して return (再送しても解決しない)', async () => {
    stubFetch(404)
    await forwardEventToUpstream(RAW_BODY, SIGNATURE)
    expect(calls.length).toBe(1)
  })
})
