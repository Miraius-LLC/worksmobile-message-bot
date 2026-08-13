import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { type AuthenticatedEnv, tokenMiddleware } from '@/routes/_middleware'
import {
  createRichMenu,
  deleteRichMenu,
  listRichMenus,
  richMenuCreateSchema,
  richMenuImageSchema,
  setDefaultRichMenu,
  uploadRichMenuImage,
} from '@/services/lineworks/menus/rich'

/**
 * リッチメニュー (rich menu) の HTTP ルータ。
 *
 * app.ts で `app.route('/menus/rich', richMenuApp)` で mount するため、
 * 各エンドポイントは `/` を起点に登録する。BASIC 認証は app.ts の wildcard で適用済。
 *
 * 提供するのは MVP 5 endpoint:
 *  - POST /        作成
 *  - GET /         一覧
 *  - POST /:id/image     画像登録 (application/json, fileId)
 *  - POST /:id/set-default デフォルト適用
 *  - DELETE /:id   削除 (404 idempotent)
 */
export const richMenuApp = new Hono<AuthenticatedEnv>()

richMenuApp.use('*', tokenMiddleware)

/** POST /menus/rich — 作成 */
richMenuApp.post(
  '/',
  zValidator('json', richMenuCreateSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const body = c.req.valid('json')
    const result = await createRichMenu(c.var.token, body)
    return c.json(result)
  },
)

/** GET /menus/rich — 一覧 (常に配列を返す) */
richMenuApp.get('/', async c => {
  const list = await listRichMenus(c.var.token)
  return c.json({ richmenus: list })
})

/** POST /menus/rich/:id/image — 事前アップロード済み fileId で画像を登録 */
richMenuApp.post(
  '/:id/image',
  zValidator('json', richMenuImageSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    await uploadRichMenuImage(c.var.token, id, body)
    return c.body(null, 204)
  },
)

/** POST /menus/rich/:id/set-default — 全ユーザー共通のデフォルトに設定 */
richMenuApp.post('/:id/set-default', async c => {
  const id = c.req.param('id')
  await setDefaultRichMenu(c.var.token, id)
  return c.json({ richmenuId: id })
})

/** DELETE /menus/rich/:id — 削除 (idempotent) */
richMenuApp.delete('/:id', async c => {
  const id = c.req.param('id')
  await deleteRichMenu(c.var.token, id)
  return c.body(null, 204)
})
