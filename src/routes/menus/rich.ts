import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { type AuthenticatedEnv, tokenMiddleware } from '@/routes/_middleware'
import {
  createRichMenu,
  deleteRichMenu,
  listRichMenus,
  RICH_MENU_IMAGE_LIMITS,
  richMenuCreateSchema,
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
 *  - POST /:id/image     画像登録 (multipart/form-data, file フィールド)
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

/**
 * POST /menus/rich/:id/image — 画像登録
 *
 * `multipart/form-data` で `file` フィールドに画像を載せる。
 * 1MB の bodyLimit + Content-Type 検証で route 層で早期 reject、
 * サイズ・解像度の厳密検証は LINE WORKS 側に委ねる
 */
richMenuApp.post(
  '/:id/image',
  bodyLimit({
    maxSize: RICH_MENU_IMAGE_LIMITS.maxBytes,
    onError: c =>
      c.json(
        {
          error: `画像サイズが上限 (${RICH_MENU_IMAGE_LIMITS.maxBytes / 1024 / 1024}MB) を超えています`,
        },
        413,
      ),
  }),
  async c => {
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) {
      return c.json({ error: 'file フィールドに画像をアップロードしてください' }, 400)
    }
    const allowed = RICH_MENU_IMAGE_LIMITS.allowedMimeTypes as readonly string[]
    if (!allowed.includes(file.type)) {
      return c.json(
        { error: `画像形式は ${allowed.join(' / ')} のみ対応 (受信: ${file.type})` },
        400,
      )
    }
    await uploadRichMenuImage(c.var.token, id, file, file.name)
    return c.json({ richmenuId: id })
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
