import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { type AuthenticatedEnv, tokenMiddleware } from '../_middleware'
import { downloadHandler } from './download'
import { uploadHandler } from './upload'

/** LINE WORKS Bot のファイルアップロード上限に揃えた 10 MB 制限 */
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

/** `/attachments` 配下の upload/download をまとめた Hono ルータ */
export const attachmentsApp = new Hono<AuthenticatedEnv>()

attachmentsApp.use('*', tokenMiddleware)

attachmentsApp.post(
  '/',
  bodyLimit({
    maxSize: MAX_UPLOAD_SIZE,
    onError: c =>
      c.json(
        { error: `ファイルサイズが上限 (${MAX_UPLOAD_SIZE / 1024 / 1024}MB) を超えています` },
        413,
      ),
  }),
  uploadHandler,
)
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
