import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import {
  type MessageBody,
  type MessageType,
  messageSchemas,
  messageTypes,
  sendMessageByType,
} from '@/services/lineworks/messages'
import type { MessageTarget } from '@/types/lineworks'
import { config } from '@/utils/config'
import { type AuthenticatedEnv, tokenMiddleware } from './_middleware'

/** README に記載の `(channels|users)/:id/messages/type/<type>` を全部登録した Hono ルータ */
export const messagesApp = new Hono<AuthenticatedEnv>()

messagesApp.use('*', tokenMiddleware)

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

        // throw されたエラーは index.ts の app.onError が拾って 500 を返す
        await sendMessageByType(config().botId, c.var.token, target, type, body)
        return c.body(null, 200)
      },
    )
  }
}
