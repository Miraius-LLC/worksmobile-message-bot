import type { Context } from 'hono'
import { resolveDownloadUrl } from '@/services/lineworks/attachment'
import { getServerToken } from '@/services/lineworks/auth'
import { logger } from '@/utils/logger'

const CALLER = 'routes/attachments/download'

const HOP_BY_HOP = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding'])

export async function downloadHandler(c: Context): Promise<Response> {
  const fileId = c.req.param('fileId')
  if (!fileId) {
    return c.json({ error: 'fileId が指定されていません。' }, 400)
  }

  try {
    const token = await getServerToken()
    const downloadUrl = await resolveDownloadUrl(token, fileId)

    const fileResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

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
      headers.set('Content-Disposition', `attachment; filename="${fileId}"`)
    }

    return new Response(fileResponse.body, { status: 200, headers })
  } catch (error) {
    logger.error('ファイルダウンロードエラー', { caller: `${CALLER}.handler`, error })
    return c.json({ error: (error as Error).message }, 500)
  }
}
