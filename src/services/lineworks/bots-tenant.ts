import { z } from 'zod'
import { fetchWithTimeout } from '@/services/lineworks/_fetch'
import { API_BASE, LineWorksApiError } from '@/services/lineworks/api'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/bots-tenant'

// =============================================================================
// 共通 sub-schema
// =============================================================================

const i18nLanguageSchema = z.enum(['ja_JP', 'ko_KR', 'en_US', 'zh_CN', 'zh_TW'])

const i18nValueSchema = z.object({
  language: i18nLanguageSchema,
  value: z.string(),
})

/** HTTPS URL チェック (photoUrl / callbackUrl) */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

const httpsUrlSchema = z
  .string()
  .max(1000)
  .refine(isHttpsUrl, { message: 'HTTPS の URL を指定してください' })

/** Callback で受信可能なメッセージタイプ */
const callbackEventTypeSchema = z.enum([
  'text',
  'location',
  'sticker',
  'image',
  'file',
  'audio',
  'video',
])

/** Callback で受信可能なトークルームイベント */
const channelEventTypeSchema = z.enum(['join', 'leave', 'joined', 'left', 'begin', 'end'])

// =============================================================================
// Bot create body schema (POST / PUT で共通)
// =============================================================================

/**
 * Bot 作成 / 完全置換時の body。
 * spec: botName / photoUrl / description / administrators 必須、その他任意。
 *
 * callbackUrl は HTTPS 必須、photoUrl も HTTPS 必須 (PNG 推奨)。
 * enableCallback を true にしたら callbackUrl も指定する運用が想定される
 */
export const botCreateSchema = z.object({
  botName: z.string().min(1).max(100),
  photoUrl: httpsUrlSchema,
  description: z.string().min(1).max(100),
  administrators: z.array(z.string()).min(1).max(3),
  subadministrators: z.array(z.string()).max(3).optional(),
  allowDomains: z.array(z.number()).optional(),
  enableCallback: z.boolean().optional(),
  callbackUrl: httpsUrlSchema.optional(),
  callbackEvents: z.array(callbackEventTypeSchema).optional(),
  channelEvents: z.array(channelEventTypeSchema).optional(),
  enableGroupJoin: z.boolean().optional(),
  defaultRichmenuId: z.string().optional(),
  i18nBotNames: z.array(i18nValueSchema).optional(),
  i18nDescriptions: z.array(i18nValueSchema).optional(),
  i18nPhotoUrls: z
    .array(z.object({ language: i18nLanguageSchema, value: httpsUrlSchema }))
    .optional(),
})

export type BotCreateInput = z.infer<typeof botCreateSchema>

/** PATCH (部分更新) は全フィールド optional */
export const botPatchSchema = botCreateSchema.partial()
export type BotPatchInput = z.infer<typeof botPatchSchema>

// =============================================================================
// レスポンス型
// =============================================================================

export type BotInfo = BotCreateInput & {
  botId: string
  createdTime?: string
  modifiedTime?: string
}

export type BotListResult = {
  bots: BotInfo[]
  responseMetaData?: { nextCursor?: string }
}

export type ReissueSecretResult = { botSecret: string }

// =============================================================================
// HTTP ヘルパ
// =============================================================================

function botsUrl(botId?: string): string {
  return botId ? `${API_BASE}/bots/${botId}` : `${API_BASE}/bots`
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

/** Bot を新規作成 → botId 含む BotInfo を返す */
export async function createBot(token: string, input: BotCreateInput): Promise<BotInfo> {
  const response = await fetchWithTimeout(botsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.createBot`)

  const data = (await response.json()) as BotInfo
  if (!data?.botId) throw new Error('createBot: レスポンスに botId が含まれていません')
  logger.success('Bot を作成', { caller: `${CALLER}.createBot`, id: data.botId })
  return data
}

/** テナント内の Bot 一覧を取得 (spec 上ページングなしの想定だが将来対応) */
export async function listBots(token: string): Promise<BotListResult> {
  const response = await fetchWithTimeout(botsUrl(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.listBots`)

  // spec 上 { bots: [...] } 想定。レスポンスが配列の可能性も保険対応
  const raw = (await response.json()) as { bots?: BotInfo[] } | BotInfo[]
  return Array.isArray(raw) ? { bots: raw } : { bots: raw.bots ?? [] }
}

/** Bot 取得。未存在 (404) は null */
export async function getBot(token: string, botId: string): Promise<BotInfo | null> {
  const response = await fetchWithTimeout(botsUrl(botId), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) return null
  if (!response.ok) await throwUpstream(response, `${CALLER}.getBot`)

  return (await response.json()) as BotInfo
}

/** Bot を完全置換 (PUT)。すべての必須フィールドを再送する必要あり */
export async function replaceBot(
  token: string,
  botId: string,
  input: BotCreateInput,
): Promise<BotInfo> {
  const response = await fetchWithTimeout(botsUrl(botId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.replaceBot`)

  logger.success('Bot を完全置換', { caller: `${CALLER}.replaceBot`, id: botId })
  return (await response.json()) as BotInfo
}

/** Bot を部分更新 (PATCH)。送ったフィールドだけ更新される */
export async function patchBot(
  token: string,
  botId: string,
  input: BotPatchInput,
): Promise<BotInfo> {
  const response = await fetchWithTimeout(botsUrl(botId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.patchBot`)

  logger.success('Bot を部分更新', { caller: `${CALLER}.patchBot`, id: botId })
  return (await response.json()) as BotInfo
}

/**
 * Bot を削除する。**破壊的操作**: 削除した Bot は復元できない。
 * 404 は idempotent に成功扱い (既に削除済の Bot に対する DELETE は通す)
 */
export async function deleteBot(token: string, botId: string): Promise<void> {
  const response = await fetchWithTimeout(botsUrl(botId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) {
    logger.info('対象 Bot は既に存在しないため削除は no-op', {
      caller: `${CALLER}.deleteBot`,
      id: botId,
    })
    return
  }
  if (!response.ok) await throwUpstream(response, `${CALLER}.deleteBot`)

  logger.success('Bot を削除', { caller: `${CALLER}.deleteBot`, id: botId })
}

/**
 * Bot Secret を再発行する。**破壊的操作**: 既存の Bot Secret は無効化される。
 * Callback の署名検証用 BOT_SECRET 設定を更新する必要があるので、呼び出し側で
 * Secret Manager の更新も忘れずに行うこと
 */
export async function reissueBotSecret(token: string, botId: string): Promise<ReissueSecretResult> {
  const response = await fetchWithTimeout(`${botsUrl(botId)}/secret`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.reissueBotSecret`)

  const data = (await response.json()) as ReissueSecretResult
  logger.success('Bot Secret を再発行', {
    caller: `${CALLER}.reissueBotSecret`,
    id: botId,
  })
  return data
}
