import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { getServerToken } from '@/services/lineworks/auth'
import { messageSchemas, messageSenders, messageTypes } from '@/services/lineworks/messages'
import type { MessageSender, MessageTarget } from '@/types/lineworks'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'routes/messages'

/** README に記載の `(channels|users)/:id/messages/type/<type>` を全部登録した Hono ルータ */
export const messagesApp = new Hono()

for (const base of ['channels', 'users'] as const) {
  for (const type of messageTypes) {
    const schema = messageSchemas[type]
    // sender の body 型は schema 由来でそれぞれ別だが、ループ内では union になり静的に narrow
    // できないため `MessageSender` (body: unknown) として扱う。zValidator が事前に schema に
    // 一致することを保証している
    const sender = messageSenders[type] as MessageSender
    messagesApp.post(
      `/${base}/:id/messages/type/${type}`,
      zValidator('json', schema, (result, c) => {
        if (!result.success) {
          // 既存 API の `{"error": "..."}` 形式に揃える (issues[0] のメッセージを採用)
          const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
          return c.json({ error: message }, 400)
        }
      }),
      async c => {
        const id = c.req.param('id')
        const body = c.req.valid('json')
        const target: MessageTarget = base === 'channels' ? { channelId: id } : { userId: id }

        try {
          const token = await getServerToken()
          await sender(config().botId, token, target, body)
          return c.body(null, 200)
        } catch (error) {
          logger.error('メッセージ送信に失敗', {
            caller: `${CALLER}.${base}.${type}`,
            id,
            error,
          })
          return c.json({ error: (error as Error).message }, 500)
        }
      },
    )
  }
}
