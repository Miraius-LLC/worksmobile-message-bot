import type { Context } from 'hono'
import { FetchTimeoutError, fetchWithTimeout } from '@/services/lineworks/_fetch'
import { resolveDownloadUrl } from '@/services/lineworks/attachment'
import { logger } from '@/utils/logger'
import type { AuthenticatedEnv } from '../_middleware'

const CALLER = 'routes/attachments/download'

const HOP_BY_HOP = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding'])

export async function downloadHandler(c: Context<AuthenticatedEnv>): Promise<Response> {
  const fileId = c.req.param('fileId')
  if (!fileId) {
    return c.json({ error: 'fileId が指定されていません。' }, 400)
  }

  const downloadUrl = await resolveDownloadUrl(c.var.token, fileId)
  let fileResponse: Response
  try {
    fileResponse = await fetchWithTimeout(downloadUrl, {
      headers: { Authorization: `Bearer ${c.var.token}` },
    })
  } catch (error) {
    // 署名付き URL を含みうるエラーを onError へ流さず、本文とログを固定値にする。
    logger.error('ダウンロード本体の取得に失敗', {
      caller: `${CALLER}.handler`,
      debug: error instanceof FetchTimeoutError ? 'timeout' : 'fetch_error',
    })
    return c.json({ error: 'ファイルのダウンロードに失敗しました。' }, 500)
  }

  if (!fileResponse.ok || !fileResponse.body) {
    logger.error('ダウンロード本体の取得に失敗', {
      caller: `${CALLER}.handler`,
      status: fileResponse.status,
    })
    return c.json({ error: 'ファイルのダウンロードに失敗しました。' }, 500)
  }

  const headers = new Headers()
  for (const [key, value] of fileResponse.headers.entries()) {
    if (HOP_BY_HOP.has(key)) continue
    headers.set(key, value)
  }
  if (!headers.has('content-disposition')) {
    // fileId は `/:fileId` 経由で任意文字列が来うる。`"` / CRLF 混入を encodeURIComponent で抑止し、
    // RFC 5987 形式 (filename*) を併記して非 ASCII も安全に扱う
    const safeName = encodeURIComponent(fileId)
    headers.set(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
    )
  }
  const upstreamReader = fileResponse.body.getReader()
  const safeBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read()
        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      } catch {
        // Response 返却後の本文エラーも署名付き URL を含みうる。
        logger.error('ダウンロード本文の受信に失敗', {
          caller: `${CALLER}.handler`,
        })
        controller.error(new Error('ファイルのダウンロードに失敗しました。'))
      }
    },
    async cancel(reason) {
      await upstreamReader.cancel(reason)
    },
  })
  return new Response(safeBody, { status: 200, headers })
}
