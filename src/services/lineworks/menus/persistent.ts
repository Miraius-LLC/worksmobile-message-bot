import { z } from 'zod'
import { API_BASE, getBotId, LineWorksApiError } from '@/services/lineworks/api'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/menus/persistent'

// =============================================================================
// Zod schema (固定メニューの構造)
// =============================================================================

/** LINE WORKS の i18n 対応言語 5 種 */
const i18nLanguageSchema = z.enum(['ja_JP', 'ko_KR', 'en_US', 'zh_CN', 'zh_TW'])

const i18nLabelSchema = z.object({
  language: i18nLanguageSchema,
  label: z.string().max(1000),
})

const i18nTextSchema = z.object({
  language: i18nLanguageSchema,
  text: z.string().max(300),
})

/** HTTP / HTTPS の URL 形式チェック (messages/index.ts と同じ判定) */
function isWebUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const messageActionSchema = z.object({
  type: z.literal('message'),
  label: z.string().min(1).max(1000),
  text: z.string().min(1).max(300),
  postback: z.string().max(1000).optional(),
  i18nLabels: z.array(i18nLabelSchema).optional(),
  i18nTexts: z.array(i18nTextSchema).optional(),
})

const uriActionSchema = z.object({
  type: z.literal('uri'),
  label: z.string().min(1).max(1000),
  uri: z.string().max(1000).refine(isWebUrl, { message: 'HTTP / HTTPS の URL を指定してください' }),
  i18nLabels: z.array(i18nLabelSchema).optional(),
})

const copyActionSchema = z.object({
  type: z.literal('copy'),
  label: z.string().min(1).max(1000),
  copyText: z.string().min(1).max(1000),
  i18nLabels: z.array(i18nLabelSchema).optional(),
})

/** 固定メニューの 1 ボタン (3 type の discriminatedUnion) */
export const persistentMenuActionSchema = z.discriminatedUnion('type', [
  messageActionSchema,
  uriActionSchema,
  copyActionSchema,
])

/** 固定メニュー全体: actions は最大 4 件まで */
export const persistentMenuSchema = z.object({
  content: z.object({
    actions: z.array(persistentMenuActionSchema).max(4),
  }),
})

export type PersistentMenu = z.infer<typeof persistentMenuSchema>
export type PersistentMenuAction = z.infer<typeof persistentMenuActionSchema>

// =============================================================================
// 共通 HTTP ヘルパ
// =============================================================================

function persistentMenuUrl(): string {
  return `${API_BASE}/bots/${getBotId()}/persistentmenu`
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
// 公開関数 (POST / GET / DELETE)
// =============================================================================

/**
 * 固定メニューを登録する (上書き)。
 * spec の制約 (actions 最大 4 / label 最大 1000 / text 最大 300) は Zod schema 側で担保。
 * 失敗時は LineWorksApiError を throw する。
 */
export async function setPersistentMenu(
  token: string,
  menu: PersistentMenu,
): Promise<PersistentMenu> {
  const response = await fetch(persistentMenuUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(menu),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.setPersistentMenu`)

  const text = await response.text()
  const data = text ? (JSON.parse(text) as PersistentMenu) : menu
  logger.success('固定メニューを登録', { caller: `${CALLER}.setPersistentMenu` })
  return data
}

/**
 * 固定メニューを取得する。未登録の場合は `null` を返す (404 は LineWorksApiError ではなく null に変換)。
 */
export async function getPersistentMenu(token: string): Promise<PersistentMenu | null> {
  const response = await fetch(persistentMenuUrl(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) return null
  if (!response.ok) await throwUpstream(response, `${CALLER}.getPersistentMenu`)

  return (await response.json()) as PersistentMenu
}

/**
 * 固定メニューを削除する。
 * 未登録のものを削除しようとした場合 (404) も成功扱いで idempotent にする。
 */
export async function deletePersistentMenu(token: string): Promise<void> {
  const response = await fetch(persistentMenuUrl(), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) {
    logger.info('固定メニューは未登録のため delete は no-op', {
      caller: `${CALLER}.deletePersistentMenu`,
    })
    return
  }
  if (!response.ok) await throwUpstream(response, `${CALLER}.deletePersistentMenu`)

  logger.success('固定メニューを削除', { caller: `${CALLER}.deletePersistentMenu` })
}
