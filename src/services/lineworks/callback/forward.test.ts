import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { forwardEventTo501 } from '@/services/lineworks/callback/forward'

// fetchWithTimeout は内部で globalThis.fetch を呼ぶので、global fetch を差し替える
// (= _fetch モジュールを mock.module すると他テストにリークするため、global fetch の
//  差し替え + afterEach 復元のリークしない方式を使う)。
// 転送先 URL は setup.ts が FORWARD_501_CALLBACK_URL=https://scheduler-501.test/callback
// を test fixture env にセット済 → config().forward501CallbackUrl から解決される。

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

describe('forwardEventTo501', () => {
  test('501 の URL に raw body + X-WORKS-Signature をそのまま転送する', async () => {
    stubFetch(200)
    await forwardEventTo501(RAW_BODY, SIGNATURE)
    expect(calls.length).toBe(1)
    expect(calls[0]?.url).toBe('https://scheduler-501.test/callback')
    expect(calls[0]?.init?.method).toBe('POST')
    expect(calls[0]?.init?.body).toBe(RAW_BODY)
    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('X-WORKS-Signature')).toBe(SIGNATURE)
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  test('2xx は throw しない', async () => {
    stubFetch(200)
    await expect(forwardEventTo501(RAW_BODY, SIGNATURE)).resolves.toBeUndefined()
  })

  test('4xx は throw しない (再送ループを防ぐため warn して return)', async () => {
    stubFetch(400)
    await expect(forwardEventTo501(RAW_BODY, SIGNATURE)).resolves.toBeUndefined()
    expect(calls.length).toBe(1)
  })

  test('5xx は throw する (callback.ts が dedup unregister → 再送)', async () => {
    stubFetch(503)
    await expect(forwardEventTo501(RAW_BODY, SIGNATURE)).rejects.toThrow(
      'forward to 501 failed: 503',
    )
  })

  test('署名が undefined でも転送する (X-WORKS-Signature ヘッダなし)', async () => {
    stubFetch(200)
    await forwardEventTo501(RAW_BODY, undefined)
    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('X-WORKS-Signature')).toBeNull()
  })
})
