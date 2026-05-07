import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { getServerToken } from '@/services/lineworks/auth'
import {
  type MessageBody,
  type MessageType,
  messageSchemas,
  messageTypes,
  sendMessageByType,
} from '@/services/lineworks/messages'
import type { MessageTarget } from '@/types/lineworks'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'routes/messages'

/** README に記載の `(channels|users)/:id/messages/type/<type>` を全部登録した Hono ルータ */
export const messagesApp = new Hono()

for (const base of ['channels', 'users'] as const) {
  for (const type of messageTypes) {
    messagesApp.post(
      `/${base}/:id/messages/type/${type}`,
      zValidator('json', messageSchemas[type], (result, c) => {
        if (!result.success) {
          // 既存 API の `{"error": "..."}` 形式に揃える (issues[0] のメッセージを採用)
          const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
          return c.json({ error: message }, 400)
        }
      }),
      async c => {
        const id = c.req.param('id')
        // ループ内では type が `MessageType` 全体の union のため body を MessageBody<MessageType>
        // (= 全 schema の z.infer の union) として受ける。zValidator が schema 一致を保証
        const body = c.req.valid('json') as MessageBody<MessageType>
        const target: MessageTarget = base === 'channels' ? { channelId: id } : { userId: id }

        try {
          const token = await getServerToken()
          await sendMessageByType(config().botId, token, target, type, body)
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
