import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { LineWorksApiError } from '@/services/lineworks/api'
import { resolveDownloadUrl, uploadAttachment } from '@/services/lineworks/attachment'

let originalFetch: typeof globalThis.fetch
beforeEach(() => {
  originalFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('services/lineworks/attachment', () => {
  describe('uploadAttachment', () => {
    test('2 段階リクエスト (発行 → multipart) を順に投げて fileId を返す', async () => {
      const calls: Array<{ url: string | URL; init?: RequestInit }> = []
      const fetchSpy = mock(async (url: string | URL, init?: RequestInit) => {
        calls.push({ url, init })
        if (calls.length === 1) {
          // 1 回目: uploadUrl + fileId を発行
          return new Response(
            JSON.stringify({ uploadUrl: 'https://upload.test/u', fileId: 'F1' }),
            { status: 200 },
          )
        }
        // 2 回目: アップロード本体
        return new Response('', { status: 200 })
      })
      globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch

      const result = await uploadAttachment('tok', new Blob(['hello']), 'a.txt')
      expect(result).toEqual({ fileId: 'F1' })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      // 1 回目: 発行エンドポイント
      expect(String(calls[0]?.url)).toContain(`/bots/${process.env['BOT_ID']}/attachments`)
      // 2 回目: 発行された uploadUrl + multipart
      expect(String(calls[1]?.url)).toBe('https://upload.test/u')
      expect(calls[1]?.init?.body).toBeInstanceOf(FormData)
    })

    test('uploadUrl / fileId が返ってこなければ throw', async () => {
      globalThis.fetch = mock(
        async () => new Response(JSON.stringify({}), { status: 200 }),
      ) as unknown as typeof globalThis.fetch
      expect(uploadAttachment('tok', new Blob(['x']), 'x.txt')).rejects.toThrow(/uploadUrl/)
    })

    test('アップロード本体が非 ok は LineWorksApiError', async () => {
      let n = 0
      globalThis.fetch = mock(async () => {
        n += 1
        if (n === 1) {
          return new Response(
            JSON.stringify({ uploadUrl: 'https://upload.test/u', fileId: 'F2' }),
            { status: 200 },
          )
        }
        return new Response('upload failed body', { status: 500 })
      }) as unknown as typeof globalThis.fetch

      let caught: unknown
      try {
        await uploadAttachment('tok', new Blob(['x']), 'x.txt')
      } catch (e) {
        caught = e
      }
      expect(caught).toBeInstanceOf(LineWorksApiError)
      const err = caught as LineWorksApiError
      expect(err.status).toBe(500)
      expect(err.upstreamBody).toBe('upload failed body')
    })
  })

  describe('resolveDownloadUrl', () => {
    test('3xx + Location ヘッダから URL を抽出', async () => {
      globalThis.fetch = mock(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'https://signed.test/file' },
          }),
      ) as unknown as typeof globalThis.fetch
      const url = await resolveDownloadUrl('tok', 'F1')
      expect(url).toBe('https://signed.test/file')
    })

    test('200 + downloadUrl body の場合は body から抽出', async () => {
      globalThis.fetch = mock(
        async () =>
          new Response(JSON.stringify({ downloadUrl: 'https://signed.test/x' }), {
            status: 200,
          }),
      ) as unknown as typeof globalThis.fetch
      const url = await resolveDownloadUrl('tok', 'F1')
      expect(url).toBe('https://signed.test/x')
    })

    test('3xx だが Location が無い → throw', async () => {
      globalThis.fetch = mock(
        async () => new Response(null, { status: 302 }),
      ) as unknown as typeof globalThis.fetch
      expect(resolveDownloadUrl('tok', 'F1')).rejects.toThrow(/Location/)
    })

    test('upstream 失敗は LineWorksApiError', async () => {
      globalThis.fetch = mock(
        async () => new Response('not found body', { status: 404 }),
      ) as unknown as typeof globalThis.fetch
      let caught: unknown
      try {
        await resolveDownloadUrl('tok', 'F1')
      } catch (e) {
        caught = e
      }
      expect(caught).toBeInstanceOf(LineWorksApiError)
      const err = caught as LineWorksApiError
      expect(err.status).toBe(404)
      expect(err.upstreamBody).toBe('not found body')
    })

    test('redirect: "manual" + Authorization ヘッダで GET する', async () => {
      const fetchSpy = mock(
        async (_url: string | URL, _init?: RequestInit) =>
          new Response(null, {
            status: 302,
            headers: { location: 'https://signed.test/x' },
          }),
      )
      globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
      await resolveDownloadUrl('tok', 'F1')
      const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
      expect(init?.method).toBe('GET')
      expect(init?.redirect).toBe('manual')
      const headers = init?.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer tok')
    })
  })
})
