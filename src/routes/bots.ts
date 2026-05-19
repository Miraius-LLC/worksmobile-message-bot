import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { type AuthenticatedEnv, tokenMiddleware } from '@/routes/_middleware'
import {
  botCreateSchema,
  botPatchSchema,
  createBot,
  deleteBot,
  getBot,
  listBots,
  patchBot,
  reissueBotSecret,
  replaceBot,
} from '@/services/lineworks/bots-tenant'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'routes/bots'

/**
 * テナント Bot CRUD のルータ。
 *
 * app.ts で `app.route('/bots', botsApp)` で mount する。
 * 既存ルート (`/channels` 等) は env 経由の暗黙 BOT_ID で動くが、本ルータは
 * `:botId` を URL に明示するパラダイム (multi-bot 管理用)。
 *
 * 本番運用中の BOT_ID と一致する `:botId` に対する `DELETE` / `POST .../secret` は
 * 「自分自身を消す/Secret を再発行する」操作になるため、警告ログを出して
 * クライアントに気づかせる (route 層では拒否はしない)
 */
export const botsApp = new Hono<AuthenticatedEnv>()

botsApp.use('*', tokenMiddleware)

/** POST /bots — Bot 作成 */
botsApp.post(
  '/',
  zValidator('json', botCreateSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const body = c.req.valid('json')
    const result = await createBot(c.var.token, body)
    return c.json(result, 201)
  },
)

/** GET /bots — テナント内 Bot 一覧 */
botsApp.get('/', async c => {
  const result = await listBots(c.var.token)
  return c.json(result)
})

/** GET /bots/:botId — Bot 取得 (未登録は 200 + null) */
botsApp.get('/:botId', async c => {
  const botId = c.req.param('botId')
  const info = await getBot(c.var.token, botId)
  return c.json(info)
})

/** PUT /bots/:botId — Bot 完全置換 */
botsApp.put(
  '/:botId',
  zValidator('json', botCreateSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const botId = c.req.param('botId')
    const body = c.req.valid('json')
    const result = await replaceBot(c.var.token, botId, body)
    return c.json(result)
  },
)

/** PATCH /bots/:botId — Bot 部分更新 */
botsApp.patch(
  '/:botId',
  zValidator('json', botPatchSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const botId = c.req.param('botId')
    const body = c.req.valid('json')
    const result = await patchBot(c.var.token, botId, body)
    return c.json(result)
  },
)

/** DELETE /bots/:botId — Bot 削除 (破壊的、404 idempotent) */
botsApp.delete('/:botId', async c => {
  const botId = c.req.param('botId')
  if (botId === config().botId) {
    logger.warn('本番運用中の BOT_ID に対する削除リクエスト', {
      caller: `${CALLER}.deleteBot`,
      id: botId,
    })
  }
  await deleteBot(c.var.token, botId)
  return c.body(null, 204)
})

/** POST /bots/:botId/secret — Bot Secret 再発行 (破壊的、要 Secret Manager 更新) */
botsApp.post('/:botId/secret', async c => {
  const botId = c.req.param('botId')
  if (botId === config().botId) {
    logger.warn(
      '本番運用中の BOT_ID の Secret を再発行 → Secret Manager の lineworks-bot-secret を更新しないと Callback 署名検証が失敗します',
      {
        caller: `${CALLER}.reissueSecret`,
        id: botId,
      },
    )
  }
  const result = await reissueBotSecret(c.var.token, botId)
  return c.json(result)
})
