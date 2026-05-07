import type { Context } from 'hono'
import { uploadAttachment } from '@/services/lineworks/attachment'
import { getServerToken } from '@/services/lineworks/auth'
import { logger } from '@/utils/logger'

const CALLER = 'routes/attachments/upload'

export async function uploadHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) {
      return c.json({ error: 'ファイルがアップロードされていません。' }, 400)
    }

    const token = await getServerToken()
    const result = await uploadAttachment(token, file, file.name)
    return c.json(result)
  } catch (error) {
    logger.error('ファイルアップロードエラー', { caller: `${CALLER}.handler`, error })
    return c.json({ error: (error as Error).message }, 500)
  }
}
