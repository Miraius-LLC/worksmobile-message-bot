import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { type AuthenticatedEnv, tokenMiddleware } from '@/routes/_middleware'
import {
  deletePersistentMenu,
  getPersistentMenu,
  persistentMenuSchema,
  setPersistentMenu,
} from '@/services/lineworks/menus/persistent'

/**
 * 固定メニュー (persistent menu) の HTTP ルータ。
 *
 * app.ts で `app.route('/menus/persistent', persistentMenuApp)` で mount するため、
 * 各エンドポイントは `/` を起点に登録する。BASIC 認証は app.ts の wildcard で適用済。
 */
export const persistentMenuApp = new Hono<AuthenticatedEnv>()

// このルータの全エンドポイントは LINE WORKS Bot API を叩くため tokenMiddleware が必須。
// mount prefix `/menus/persistent` で scope が限定されるので `*` で安全
persistentMenuApp.use('*', tokenMiddleware)

/** POST /menus/persistent — 固定メニューを登録 (上書き) */
persistentMenuApp.post(
  '/',
  zValidator('json', persistentMenuSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const menu = c.req.valid('json')
    const result = await setPersistentMenu(c.var.token, menu)
    return c.json(result)
  },
)

/** GET /menus/persistent — 固定メニューを取得 (未登録時は 200 + null) */
persistentMenuApp.get('/', async c => {
  const menu = await getPersistentMenu(c.var.token)
  return c.json(menu)
})

/** DELETE /menus/persistent — 固定メニューを削除 (未登録時も 204) */
persistentMenuApp.delete('/', async c => {
  await deletePersistentMenu(c.var.token)
  return c.body(null, 204)
})
