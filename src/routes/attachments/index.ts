import { Hono } from 'hono'
import { downloadHandler } from './download'
import { uploadHandler } from './upload'

/** `/attachments` 配下の upload/download をまとめた Hono ルータ */
export const attachmentsApp = new Hono()

attachmentsApp.post('/', uploadHandler)
attachmentsApp.get('/:fileId', downloadHandler)

attachmentsApp.notFound(c =>
  c.json(
    {
      error: 'Attachment Not Found',
      message: `添付ファイル ${c.req.url} が見つかりません`,
      path: c.req.url,
      timestamp: new Date().toISOString(),
      statusCode: 404,
    },
    404,
  ),
)
