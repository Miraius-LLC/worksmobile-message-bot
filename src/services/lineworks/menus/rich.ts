import { z } from 'zod'
import { API_BASE, getBotId, LineWorksApiError } from '@/services/lineworks/api'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/menus/rich'

// =============================================================================
// Zod schema (rich menu のリクエスト構造)
// =============================================================================

/**
 * size: 幅は 2500 固定、高さは 843 (compact) または 1686 (full) のみ受け付ける。
 * LINE WORKS の rich menu spec に準拠。
 */
const richMenuSizeSchema = z.object({
  width: z.literal(2500),
  height: z.union([z.literal(843), z.literal(1686)]),
})

/** タップ領域の bounds */
const boundsSchema = z.object({
  x: z.number().int().min(0).max(2500),
  y: z.number().int().min(0).max(1686),
  width: z.number().int().min(1).max(2500),
  height: z.number().int().min(1).max(1686),
})

/** HTTP / HTTPS の URL 形式チェック */
function isWebUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * rich menu の action: spec で `postback` / `message` / `uri` / `copy` の 4 種のみ。
 * label は 20 文字以内 (rich menu 共通の上限)。
 */
const richMenuActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('postback'),
    label: z.string().min(1).max(20),
    data: z.string().min(1).max(300),
    displayText: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal('message'),
    label: z.string().min(1).max(20),
    text: z.string().min(1).max(300),
    postback: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('uri'),
    label: z.string().min(1).max(20),
    uri: z
      .string()
      .max(1000)
      .refine(isWebUrl, { message: 'HTTP / HTTPS の URL を指定してください' }),
  }),
  z.object({
    type: z.literal('copy'),
    label: z.string().min(1).max(20),
    copyText: z.string().min(1).max(1000),
  }),
])

/** タップ領域: bounds と action のペア */
const richMenuAreaSchema = z.object({
  bounds: boundsSchema,
  action: richMenuActionSchema,
})

/** rich menu 作成リクエスト全体 */
export const richMenuCreateSchema = z.object({
  richmenuName: z.string().min(1).max(300),
  size: richMenuSizeSchema,
  areas: z.array(richMenuAreaSchema).min(1),
})

export type RichMenuCreate = z.infer<typeof richMenuCreateSchema>

/** 作成レスポンス: richmenuId が返る */
export type CreateRichMenuResult = { richmenuId: string }

/** 一覧レスポンスの個別要素 (作成時の構造に richmenuId を加えたもの) */
export type RichMenu = RichMenuCreate & { richmenuId: string }

/** 画像の制約 (本ファイルで強制はしないが、route 層 / 呼び出し側のチェック基準) */
export const RICH_MENU_IMAGE_LIMITS = {
  maxBytes: 1024 * 1024, // 1MB
  allowedMimeTypes: ['image/jpeg', 'image/png'] as const,
  validDimensions: [
    { width: 2500, height: 843 },
    { width: 2500, height: 1686 },
  ] as const,
}

// =============================================================================
// 共通 HTTP ヘルパ
// =============================================================================

function richMenuBaseUrl(): string {
  return `${API_BASE}/bots/${getBotId()}/richmenus`
}

async function throwUpstream(response: Response, caller: string): Promise<never> {
  const body = await response.text().catch(() => '')
  logger.error('LINE WORKS API 呼び出しに失敗', {
    caller,
    url: response.url,
    status: response.status,
    debug: body,
  })
  throw new LineWorksApiError(response.status, body)
}

// =============================================================================
// 公開関数
// =============================================================================

/** リッチメニューを作成 → `richmenuId` を返す */
export async function createRichMenu(
  token: string,
  menu: RichMenuCreate,
): Promise<CreateRichMenuResult> {
  const response = await fetch(richMenuBaseUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(menu),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.createRichMenu`)

  const data = (await response.json()) as CreateRichMenuResult
  if (!data?.richmenuId) {
    throw new Error('createRichMenu: レスポンスに richmenuId が含まれていません')
  }
  logger.success('リッチメニューを作成', {
    caller: `${CALLER}.createRichMenu`,
    id: data.richmenuId,
  })
  return data
}

/** リッチメニュー一覧 (Bot 内に登録された全件) */
export async function listRichMenus(token: string): Promise<RichMenu[]> {
  const response = await fetch(richMenuBaseUrl(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.listRichMenus`)

  // spec ドキュメント上 `{ richmenus: [...] }` を返す想定だが、レスポンス形式が
  // 公開 doc で確定していないため、配列 / オブジェクトラップの両方を許容する
  const raw = (await response.json()) as { richmenus?: RichMenu[] } | RichMenu[]
  return Array.isArray(raw) ? raw : (raw.richmenus ?? [])
}

/**
 * リッチメニューに画像を登録する。
 *
 * 画像仕様 (spec):
 *  - 解像度: 2500x843 または 2500x1686
 *  - 形式: JPEG / PNG
 *  - サイズ: 1MB 以下
 *
 * Content-Type は LINE WORKS の他の Bot 添付 API と同じく multipart/form-data + `file` フィールドを採用。
 * (公式 doc で確証が取れていない部分。本番動作確認時に直接 image/png バイナリ POST が
 *  必要だと判明した場合はこの関数を分岐させる)
 */
export async function uploadRichMenuImage(
  token: string,
  richmenuId: string,
  image: Blob,
  filename: string,
): Promise<void> {
  const url = `${richMenuBaseUrl()}/${richmenuId}/image`

  const formData = new FormData()
  formData.append('file', image, filename)

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.uploadRichMenuImage`)

  logger.success('リッチメニュー画像を登録', {
    caller: `${CALLER}.uploadRichMenuImage`,
    id: richmenuId,
  })
}

/** リッチメニューをデフォルト (全ユーザー共通) として適用 */
export async function setDefaultRichMenu(token: string, richmenuId: string): Promise<void> {
  const url = `${richMenuBaseUrl()}/${richmenuId}/set-default`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.setDefaultRichMenu`)

  logger.success('デフォルトリッチメニューを適用', {
    caller: `${CALLER}.setDefaultRichMenu`,
    id: richmenuId,
  })
}

/** リッチメニューを削除。未登録時 (404) は idempotent に成功扱い */
export async function deleteRichMenu(token: string, richmenuId: string): Promise<void> {
  const url = `${richMenuBaseUrl()}/${richmenuId}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) {
    logger.info('リッチメニューは存在しないため delete は no-op', {
      caller: `${CALLER}.deleteRichMenu`,
      id: richmenuId,
    })
    return
  }
  if (!response.ok) await throwUpstream(response, `${CALLER}.deleteRichMenu`)

  logger.success('リッチメニューを削除', {
    caller: `${CALLER}.deleteRichMenu`,
    id: richmenuId,
  })
}
