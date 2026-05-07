import type { Context } from 'hono'
import { uploadAttachment } from '@/services/lineworks/attachment'
import { logger } from '@/utils/logger'
import type { AuthenticatedEnv } from '../_middleware'

const CALLER = 'routes/attachments/upload'

export async function uploadHandler(c: Context<AuthenticatedEnv>): Promise<Response> {
  const body = await c.req.parseBody()
  const file = body['file']
  if (!(file instanceof File)) {
    return c.json({ error: 'ファイルがアップロードされていません。' }, 400)
  }

  const result = await uploadAttachment(c.var.token, file, file.name)
  logger.success('upload エンドポイント完了', { caller: `${CALLER}.handler`, id: result.fileId })
  return c.json(result)
}
