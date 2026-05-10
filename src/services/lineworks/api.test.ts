import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  API_BASE,
  getBotId,
  LineWorksApiError,
  postJson,
  sendBotMessage,
} from '@/services/lineworks/api'
import { requireEnv } from '@/test-helpers/utils'

let originalFetch: typeof globalThis.fetch
beforeEach(() => {
  originalFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

function installFetch(handler: (url: string | URL, init?: RequestInit) => Promise<Response>) {
  const spy = mock(handler)
  globalThis.fetch = spy as unknown as typeof globalThis.fetch
  return spy
}

describe('services/lineworks/api', () => {
  test('API_BASE は LINE WORKS の v1.0', () => {
    expect(API_BASE).toBe('https://www.worksapis.com/v1.0')
  })

  test('getBotId は config().botId を返す', () => {
    expect(getBotId()).toBe(requireEnv('BOT_ID'))
  })

  describe('postJson', () => {
    test('ok + JSON body は parse される', async () => {
      const fetchSpy = installFetch(
        async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
      )
      const result = await postJson('tok', 'https://x.test/y', { a: 1 })
      expect(result).toEqual({ ok: 1 })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const call = fetchSpy.mock.calls[0]
      expect(call?.[0]).toBe('https://x.test/y')
      const init = call?.[1]
      expect(init?.method).toBe('POST')
      const headers = init?.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer tok')
      expect(headers['Content-Type']).toBe('application/json')
      expect(init?.body).toBe(JSON.stringify({ a: 1 }))
    })

    test('ok + 空 body は undefined を返す', async () => {
      installFetch(async () => new Response('', { status: 200 }))
      expect(await postJson('tok', 'https://x.test/y', {})).toBeUndefined()
    })

    test('ok + 非 JSON body は文字列のまま返す', async () => {
      installFetch(async () => new Response('plain text', { status: 200 }))
      expect(await postJson('tok', 'https://x.test/y', {})).toBe('plain text')
    })

    test('非 ok は LineWorksApiError を status + body と共に throw', async () => {
      installFetch(async () => new Response('upstream error body', { status: 404 }))
      let caught: unknown
      try {
        await postJson('tok', 'https://x.test/y', {})
      } catch (e) {
        caught = e
      }
      expect(caught).toBeInstanceOf(LineWorksApiError)
      const err = caught as LineWorksApiError
      expect(err.status).toBe(404)
      expect(err.upstreamBody).toBe('upstream error body')
    })
  })

  describe('sendBotMessage', () => {
    test('content を `{ content }` で wrap して POST する', async () => {
      const fetchSpy = installFetch(async () => new Response('', { status: 200 }))
      await sendBotMessage('tok', 'https://x.test/msg', { type: 'text', text: 'hi' })
      const body = fetchSpy.mock.calls[0]?.[1]?.body
      expect(JSON.parse(body as string)).toEqual({
        content: { type: 'text', text: 'hi' },
      })
    })
  })
})
