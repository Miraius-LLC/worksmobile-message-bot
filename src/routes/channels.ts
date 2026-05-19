import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { type AuthenticatedEnv, tokenMiddleware } from '@/routes/_middleware'
import {
  createChannel,
  createChannelSchema,
  getChannel,
  leaveChannel,
  listChannelMembers,
  listMembersQuerySchema,
} from '@/services/lineworks/channels'

/**
 * チャンネル (トークルーム) 管理の HTTP ルータ。
 *
 * app.ts で `app.route('/channels', channelsApp)` で mount する。
 * messagesApp も `POST /channels/:id/messages/type/<X>` を提供するが、Hono は
 * method + path を厳密に判定するため衝突しない (messagesApp は POST、本ルータの
 * GET / DELETE / `:id/members` は別経路)。
 */
export const channelsApp = new Hono<AuthenticatedEnv>()

channelsApp.use('*', tokenMiddleware)

/** POST /channels — トークルーム作成 */
channelsApp.post(
  '/',
  zValidator('json', createChannelSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const body = c.req.valid('json')
    const result = await createChannel(c.var.token, body)
    return c.json(result)
  },
)

/** GET /channels/:id — トークルーム情報取得 (404 → 200 + null) */
channelsApp.get('/:id', async c => {
  const id = c.req.param('id')
  const info = await getChannel(c.var.token, id)
  return c.json(info)
})

/** DELETE /channels/:id — Bot 退室 (idempotent) */
channelsApp.delete('/:id', async c => {
  const id = c.req.param('id')
  await leaveChannel(c.var.token, id)
  return c.body(null, 204)
})

/** GET /channels/:id/members — メンバー一覧 (count / cursor ページング) */
channelsApp.get(
  '/:id/members',
  zValidator('query', listMembersQuerySchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'クエリパラメータが不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const id = c.req.param('id')
    const query = c.req.valid('query')
    const result = await listChannelMembers(c.var.token, id, query)
    return c.json(result)
  },
)
