import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { FetchTimeoutError, fetchWithTimeout, LONG_TIMEOUT_MS } from '@/services/lineworks/_fetch'

let originalFetch: typeof globalThis.fetch
beforeEach(() => {
  originalFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('fetchWithTimeout', () => {
  test('成功レスポンスはそのまま透過', async () => {
    globalThis.fetch = mock(
      async () => new Response('ok', { status: 200 }),
    ) as unknown as typeof globalThis.fetch
    const res = await fetchWithTimeout('https://x.test/y')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  test('init.method / headers / body はそのまま fetch に渡る', async () => {
    let captured: { url: string; init?: RequestInit } | undefined
    globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
      captured = { url: String(url), init }
      return new Response('', { status: 200 })
    }) as unknown as typeof globalThis.fetch

    await fetchWithTimeout('https://x.test/y', {
      method: 'POST',
      headers: { 'X-Test': '1' },
      body: '{}',
    })

    expect(captured?.init?.method).toBe('POST')
    expect((captured?.init?.headers as Record<string, string>)?.['X-Test']).toBe('1')
    expect(captured?.init?.body).toBe('{}')
  })

  test('timeoutMs を超えると FetchTimeoutError', async () => {
    // 1 秒応答しない fetch を mock
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    }) as unknown as typeof globalThis.fetch

    await expect(fetchWithTimeout('https://x.test/slow', { timeoutMs: 30 })).rejects.toBeInstanceOf(
      FetchTimeoutError,
    )
  })

  test('FetchTimeoutError は url と timeoutMs を保持', async () => {
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    }) as unknown as typeof globalThis.fetch

    try {
      await fetchWithTimeout('https://x.test/slow', { timeoutMs: 20 })
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(FetchTimeoutError)
      const err = e as FetchTimeoutError
      expect(err.url).toBe('https://x.test/slow')
      expect(err.timeoutMs).toBe(20)
    }
  })

  test('caller signal 経由の abort は FetchTimeoutError ではなく素の AbortError として伝播', async () => {
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    }) as unknown as typeof globalThis.fetch

    const callerController = new AbortController()
    const promise = fetchWithTimeout('https://x.test/slow', {
      timeoutMs: 10_000,
      signal: callerController.signal,
    })
    // caller 側で即座に abort
    callerController.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    // FetchTimeoutError ではないこと
    await expect(promise).rejects.not.toBeInstanceOf(FetchTimeoutError)
  })

  test('fetch が throw した一般エラーはそのまま伝播', async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError('network error')
    }) as unknown as typeof globalThis.fetch

    await expect(fetchWithTimeout('https://x.test/y')).rejects.toThrow('network error')
  })

  test('LONG_TIMEOUT_MS は 60 秒', () => {
    expect(LONG_TIMEOUT_MS).toBe(60_000)
  })
})
