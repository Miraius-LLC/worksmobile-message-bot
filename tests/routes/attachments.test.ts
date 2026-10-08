import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { app } from '@/app'
import { attachmentsApp } from '@/routes/attachments'
import { FetchTimeoutError } from '@/services/lineworks/_fetch'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'
import { logger } from '@/utils/logger'

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'
const UPLOAD_HOST = 'upload.test'
const DL_HOST = 'signed.test'
const BASIC_AUTH = `Basic ${Buffer.from('test-user:test-pass').toString('base64')}`

let originalFetch: typeof globalThis.fetch
const originalLoggerError = logger.error
type FetchCall = { url: string; init?: RequestInit }
let calls: FetchCall[]

type DownloadOpts = {
  body?: string | null
  headers?: Record<string, string>
  status?: number
}

function installFetch(downloadOpts: DownloadOpts = {}) {
  const { body = 'file-bytes', headers = {}, status = 200 } = downloadOpts
  calls = []
  const spy = mock(async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, init })

    // OAuth トークン
    if (u.includes(AUTH_HOST)) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 86_400 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    // Upload 発行 (uploadUrl + fileId を返す)
    if (u.includes(API_HOST) && u.includes('/attachments') && !u.includes('/attachments/F-')) {
      // POST /v1.0/bots/<bot>/attachments (発行) or GET /v1.0/bots/<bot>/attachments/<fileId> (DL URL 解決)
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({ uploadUrl: `https://${UPLOAD_HOST}/u`, fileId: 'F-new' }),
          { status: 200 },
        )
      }
      // GET (但し fileId が含まれないケース — 一致しないので fall through)
    }
    // Download URL 解決 (3xx で Location を返す)
    if (u.includes(API_HOST) && u.includes('/attachments/F-')) {
      return new Response(null, {
        status: 302,
        headers: { location: `https://${DL_HOST}/x` },
      })
    }
    // multipart アップロード本体 (発行 URL)
    if (u.includes(UPLOAD_HOST)) {
      return new Response('', { status: 200 })
    }
    // 実ファイル本体
    if (u.includes(DL_HOST)) {
      return new Response(body, {
        status,
        headers: { 'content-type': 'application/octet-stream', ...headers },
      })
    }
    return new Response('unmocked', { status: 500 })
  })
  globalThis.fetch = spy as unknown as typeof globalThis.fetch
  return spy
}

beforeEach(() => {
  originalFetch = globalThis.fetch
  _resetTokenCacheForTest()
  installFetch()
})
afterEach(() => {
  globalThis.fetch = originalFetch
  logger.error = originalLoggerError
  _resetTokenCacheForTest()
})

describe('routes/attachments: upload', () => {
  test('multipart で file を送る → 200 + { fileId }', async () => {
    const form = new FormData()
    form.append('file', new Blob(['hello world']), 'a.txt')

    const res = await attachmentsApp.request('/', {
      method: 'POST',
      body: form,
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { fileId: string }
    expect(body.fileId).toBe('F-new')

    // 発行リクエストとアップロード本体が両方走ること
    expect(calls.some(c => c.url.includes(`/${UPLOAD_HOST}/u`))).toBe(true)
    expect(calls.some(c => c.url.includes('/attachments') && c.init?.method === 'POST')).toBe(true)
  })

  test('file 欠落のリクエストは 400', async () => {
    const form = new FormData()
    form.append('foo', 'bar')

    const res = await attachmentsApp.request('/', { method: 'POST', body: form })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('ファイル')
  })
})

describe('routes/attachments: download', () => {
  test('GET /:fileId → resolveDownloadUrl + body fetch + 200 でストリーム返却', async () => {
    const res = await attachmentsApp.request('/F-abc', { method: 'GET' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('file-bytes')
    expect(res.headers.get('content-type')).toBe('application/octet-stream')
    // Content-Disposition 未指定なら自動で attachment; filename=<fileId>
    expect(res.headers.get('content-disposition')).toContain('F-abc')
  })

  test('fileId に `"` / CRLF が含まれてもヘッダインジェクションされない', async () => {
    // 生の改行 / quote がヘッダ値に混入せず、注入された X-Injected ヘッダが
    // 独立して立っていないことを担保する
    const res = await attachmentsApp.request('/F-%22%0D%0AX-Injected:%201', { method: 'GET' })
    expect(res.status).toBe(200)
    const cd = res.headers.get('content-disposition') ?? ''
    expect(cd).not.toContain('\r')
    expect(cd).not.toContain('\n')
    expect(cd).toContain('%22')
    expect(cd).toContain('%0D%0A')
    expect(res.headers.get('X-Injected')).toBeNull()
  })

  test('上流の Content-Disposition は引き継がれる', async () => {
    installFetch({
      body: 'x',
      headers: { 'content-disposition': 'attachment; filename="orig.bin"' },
    })
    const res = await attachmentsApp.request('/F-abc', { method: 'GET' })
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="orig.bin"')
  })

  test('HOP_BY_HOP ヘッダ (transfer-encoding 等) は転送されない', async () => {
    installFetch({
      body: 'x',
      headers: {
        'transfer-encoding': 'chunked',
        connection: 'keep-alive',
        'keep-alive': 'timeout=5',
        'content-encoding': 'gzip',
        'x-custom-keep': 'yes', // 関係ないヘッダはそのまま通す
      },
    })
    const res = await attachmentsApp.request('/F-abc', { method: 'GET' })
    expect(res.headers.get('transfer-encoding')).toBeNull()
    expect(res.headers.get('connection')).toBeNull()
    expect(res.headers.get('keep-alive')).toBeNull()
    expect(res.headers.get('content-encoding')).toBeNull()
    expect(res.headers.get('x-custom-keep')).toBe('yes')
  })

  test('上流が非 ok の時は 500 + { error } を返す', async () => {
    installFetch({ status: 502, body: 'upstream bad gateway' })
    const res = await attachmentsApp.request('/F-abc', { method: 'GET' })
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('ダウンロード')
  })

  test('上流 body が null の時も 500 を返す', async () => {
    // HEAD 相当: 200 だが body=null。Response の body プロパティが null になるケース
    installFetch({ status: 200, body: null })
    const res = await attachmentsApp.request('/F-abc', { method: 'GET' })
    expect(res.status).toBe(500)
  })

  test('実ファイル取得時に Authorization ヘッダが付いている', async () => {
    await attachmentsApp.request('/F-abc', { method: 'GET' })
    const dlCall = calls.find(c => c.url.includes(DL_HOST))
    expect(dlCall).toBeDefined()
    const headers = dlCall?.init?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer tok')
  })

  test('実ファイル取得に timeout の AbortSignal を渡す', async () => {
    await attachmentsApp.request('/F-abc', { method: 'GET' })
    const dlCall = calls.find(c => c.url.includes(DL_HOST))
    expect(dlCall?.init?.signal).toBeInstanceOf(AbortSignal)
  })

  test('署名付きURLの取得timeoutを500本文とログに出さない', async () => {
    const signedUrl = `https://${DL_HOST}/x?token=secret-marker`
    const baseFetch = globalThis.fetch
    const logEntries: string[] = []
    logger.error = mock((message: unknown, context?: unknown) => {
      logEntries.push(JSON.stringify([message, context]))
    }) as typeof logger.error
    globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
      const requestedUrl = String(url)
      if (requestedUrl.includes(API_HOST) && requestedUrl.includes('/attachments/F-')) {
        return new Response(null, { status: 302, headers: { location: signedUrl } })
      }
      if (requestedUrl === signedUrl) {
        throw new FetchTimeoutError(signedUrl, 15_000)
      }
      return baseFetch(url, init)
    }) as unknown as typeof globalThis.fetch

    const res = await app.request('/attachments/F-abc', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('secret-marker')
    expect(logEntries.join('\n')).not.toContain('secret-marker')
  })

  test('署名付きURLの本文timeoutをstream errorとログに出さない', async () => {
    const signedUrl = `https://${DL_HOST}/x?token=secret-marker`
    const baseFetch = globalThis.fetch
    const logEntries: string[] = []
    logger.error = mock((message: unknown, context?: unknown) => {
      logEntries.push(JSON.stringify([message, context]))
    }) as typeof logger.error
    globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
      const requestedUrl = String(url)
      if (requestedUrl.includes(API_HOST) && requestedUrl.includes('/attachments/F-')) {
        return new Response(null, { status: 302, headers: { location: signedUrl } })
      }
      if (requestedUrl === signedUrl) {
        return new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              controller.error(new FetchTimeoutError(signedUrl, 15_000))
            },
          }),
        )
      }
      return baseFetch(url, init)
    }) as unknown as typeof globalThis.fetch

    const res = await app.request('/attachments/F-abc', {
      headers: { Authorization: BASIC_AUTH },
    })
    expect(res.status).toBe(200)
    let bodyError: unknown
    try {
      await res.text()
    } catch (error) {
      bodyError = error
    }
    expect(bodyError).toBeInstanceOf(Error)
    expect(String(bodyError)).not.toContain('secret-marker')
    expect(logEntries.join('\n')).not.toContain('secret-marker')
  })

  test('ダウンロードを取り消すと元の本文 stream も cancel する', async () => {
    const baseFetch = globalThis.fetch
    let cancelled = false
    globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes(DL_HOST)) {
        return new Response(
          new ReadableStream<Uint8Array>({
            cancel() {
              cancelled = true
            },
          }),
        )
      }
      return baseFetch(url, init)
    }) as unknown as typeof globalThis.fetch

    const res = await attachmentsApp.request('/F-abc', { method: 'GET' })
    await res.body?.cancel()
    expect(cancelled).toBe(true)
  })
})

describe('routes/attachments: 404 handler', () => {
  test('未定義パスは attachments 専用 404 で返る', async () => {
    const res = await attachmentsApp.request('/missing/path', { method: 'GET' })
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string; message: string }
    expect(body.error).toBe('Attachment Not Found')
    expect(body.message).toContain('見つかりません')
  })
})
