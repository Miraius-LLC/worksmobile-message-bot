import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { type AuthenticatedEnv, tokenMiddleware } from '@/routes/_middleware'
import { queryValidationHook } from '@/routes/_validation'
import {
  cancelDefaultRichMenu,
  createRichMenu,
  deleteRichMenu,
  getDefaultRichMenu,
  getRichMenu,
  getRichMenuImage,
  getUserRichMenu,
  linkRichMenuToUser,
  listRichMenus,
  listRichMenusQuerySchema,
  richMenuCreateSchema,
  richMenuImageSchema,
  setDefaultRichMenu,
  unlinkRichMenuFromUser,
  uploadRichMenuImage,
} from '@/services/lineworks/menus/rich'

/**
 * リッチメニュー (rich menu) の HTTP ルータ。
 *
 * app.ts で `app.route('/menus/rich', richMenuApp)` で mount するため、
 * 各エンドポイントは `/` を起点に登録する。BASIC 認証は app.ts の wildcard で適用済。
 *
 * 提供する 12 endpoint (MVP 5 + 追加 7 操作):
 *  - POST /                     作成
 *  - GET /                      一覧
 *  - GET /default               デフォルト取得
 *  - DELETE /default            デフォルト解除
 *  - GET /users/:userId         ユーザー別適用リッチメニュー取得
 *  - DELETE /users/:userId      ユーザー別適用リッチメニュー解除
 *  - GET /:id                   詳細取得
 *  - GET /:id/image             画像情報取得
 *  - POST /:id/image            画像登録 (application/json, fileId)
 *  - POST /:id/set-default      デフォルト適用
 *  - POST /:id/users/:userId    ユーザー別適用
 *  - DELETE /:id                削除 (404 idempotent)
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
    return c.json(result, 201)
  },
)

/** GET /menus/rich — 一覧 (count/cursor pagination 対応) */
richMenuApp.get(
  '/',
  zValidator('query', listRichMenusQuerySchema, queryValidationHook),
  async c => {
    const query = c.req.valid('query')
    const result = await listRichMenus(c.var.token, query)
    return c.json(result)
  },
)

/** GET /menus/rich/default — デフォルトリッチメニュー ID 取得 */
richMenuApp.get('/default', async c => {
  const result = await getDefaultRichMenu(c.var.token)
  return c.json(result)
})

/** DELETE /menus/rich/default — デフォルトリッチメニュー解除 */
richMenuApp.delete('/default', async c => {
  await cancelDefaultRichMenu(c.var.token)
  return c.body(null, 204)
})

/** GET /menus/rich/users/:userId — ユーザーに適用されたリッチメニュー詳細を取得 */
richMenuApp.get('/users/:userId', async c => {
  const userId = c.req.param('userId')
  const result = await getUserRichMenu(c.var.token, userId)
  return c.json(result)
})

/** DELETE /menus/rich/users/:userId — ユーザーに適用されたリッチメニューを解除 */
richMenuApp.delete('/users/:userId', async c => {
  const userId = c.req.param('userId')
  await unlinkRichMenuFromUser(c.var.token, userId)
  return c.body(null, 204)
})

/** GET /menus/rich/:id — リッチメニュー詳細取得 */
richMenuApp.get('/:id', async c => {
  const id = c.req.param('id')
  const result = await getRichMenu(c.var.token, id)
  return c.json(result)
})

/** GET /menus/rich/:id/image — 画像情報 (fileId, i18nFileIds) 取得 */
richMenuApp.get('/:id/image', async c => {
  const id = c.req.param('id')
  const result = await getRichMenuImage(c.var.token, id)
  return c.json(result)
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
  const result = await setDefaultRichMenu(c.var.token, id)
  return c.json(result, 201)
})

/** POST /menus/rich/:id/users/:userId — 特定ユーザーにリッチメニューを設定 */
richMenuApp.post('/:id/users/:userId', async c => {
  const id = c.req.param('id')
  const userId = c.req.param('userId')
  await linkRichMenuToUser(c.var.token, id, userId)
  return c.body(null, 204)
})

/** DELETE /menus/rich/:id — 削除 (idempotent) */
richMenuApp.delete('/:id', async c => {
  const id = c.req.param('id')
  await deleteRichMenu(c.var.token, id)
  return c.body(null, 204)
})
