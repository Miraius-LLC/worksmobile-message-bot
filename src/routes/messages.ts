import { type Context, Hono } from 'hono'
import { getServerToken } from '@/services/lineworks/auth'
import { type MessageType, messageSenders, messageTypes } from '@/services/lineworks/messages'
import type { MessageRequestParams } from '@/types/lineworks'
import { logger } from '@/utils/logger'

const CALLER = 'routes/messages'

type Base = 'channels' | 'users'

/** README に記載の `(channels|users)/:id/messages/type/<type>` を全部登録した Hono ルータ */
export const messagesApp = new Hono()

for (const base of ['channels', 'users'] as const) {
  for (const type of messageTypes) {
    messagesApp.post(`/${base}/:id/messages/type/${type}`, c => handle(c, base, type))
  }
}

async function handle(c: Context, base: Base, type: MessageType): Promise<Response> {
  const botId = process.env['BOT_ID']
  if (!botId) {
    return c.json({ error: "環境変数 'BOT_ID' が設定されていません。" }, 500)
  }

  const id = c.req.param('id')
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

  const targetKey = base === 'channels' ? 'channelId' : 'userId'
  const params: MessageRequestParams = { [targetKey]: id, ...body }

  try {
    const token = await getServerToken()
    await messageSenders[type](botId, token, params)
    return c.body(null, 200)
  } catch (error) {
    logger.error('メッセージ送信に失敗', {
      caller: `${CALLER}.${base}.${type}`,
      id,
      error,
    })
    return c.json({ error: (error as Error).message }, 500)
  }
}
