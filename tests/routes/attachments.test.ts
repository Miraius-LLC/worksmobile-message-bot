import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { attachmentsApp } from '@/routes/attachments'
import { _resetTokenCacheForTest } from '@/services/lineworks/auth'

const AUTH_HOST = 'auth.worksmobile.com'
const API_HOST = 'www.worksapis.com'
const UPLOAD_HOST = 'upload.test'
const DL_HOST = 'signed.test'

let originalFetch: typeof globalThis.fetch
type FetchCall = { url: string; init?: RequestInit }
let calls: FetchCall[]

function installFetch(
  downloadBody: string = 'file-bytes',
  downloadHeaders: Record<string, string> = {},
) {
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
      return new Response(downloadBody, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream', ...downloadHeaders },
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

  test('上流の Content-Disposition は引き継がれる', async () => {
    installFetch('x', { 'content-disposition': 'attachment; filename="orig.bin"' })
    const res = await attachmentsApp.request('/F-abc', { method: 'GET' })
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="orig.bin"')
  })

  test('実ファイル取得時に Authorization ヘッダが付いている', async () => {
    await attachmentsApp.request('/F-abc', { method: 'GET' })
    const dlCall = calls.find(c => c.url.includes(DL_HOST))
    expect(dlCall).toBeDefined()
    const headers = dlCall?.init?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer tok')
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
