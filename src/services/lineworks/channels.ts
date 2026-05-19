import { z } from 'zod'
import { fetchWithTimeout } from '@/services/lineworks/_fetch'
import { API_BASE, getBotId, LineWorksApiError } from '@/services/lineworks/api'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/channels'

// =============================================================================
// Zod schema
// =============================================================================

/** POST /channels の body: members 必須 (1〜100、重複なし) + title 任意 (最大 1000) */
export const createChannelSchema = z
  .object({
    members: z.array(z.string().min(1)).min(1).max(100),
    title: z.string().max(1000).optional(),
  })
  .refine(b => new Set(b.members).size === b.members.length, {
    message: 'members は重複できません',
  })

export type CreateChannelInput = z.infer<typeof createChannelSchema>

/** members 一覧の query パラメータ */
export const listMembersQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
})

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>

// =============================================================================
// レスポンス型
// =============================================================================

export type CreateChannelResult = { channelId: string; title?: string }

export type ChannelType = {
  type: 'SINGLE_USER' | 'MULTI_USERS' | 'ORGUNIT' | 'GROUP'
  orgUnitId?: string
  groupId?: string
}

export type ChannelInfo = {
  domainId: number
  channelId: string
  title?: string
  channelType: ChannelType
}

export type ChannelMembersResult = {
  members: string[]
  responseMetaData?: { nextCursor?: string }
}

// =============================================================================
// HTTP ヘルパ
// =============================================================================

function channelsBaseUrl(): string {
  return `${API_BASE}/bots/${getBotId()}/channels`
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

/**
 * トークルームを作成する。
 * 1:1 トーク (members 1 件) と複数人トーク (members 2+ 件) の両方をサポート。
 */
export async function createChannel(
  token: string,
  input: CreateChannelInput,
): Promise<CreateChannelResult> {
  const response = await fetchWithTimeout(channelsBaseUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.createChannel`)

  const data = (await response.json()) as CreateChannelResult
  if (!data?.channelId) {
    throw new Error('createChannel: レスポンスに channelId が含まれていません')
  }
  logger.success('トークルームを作成', {
    caller: `${CALLER}.createChannel`,
    id: data.channelId,
  })
  return data
}

/** トークルーム情報を取得する。存在しない場合 (404) は null を返す */
export async function getChannel(token: string, channelId: string): Promise<ChannelInfo | null> {
  const response = await fetchWithTimeout(`${channelsBaseUrl()}/${channelId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) return null
  if (!response.ok) await throwUpstream(response, `${CALLER}.getChannel`)

  return (await response.json()) as ChannelInfo
}

/** Bot をトークルームから退室させる。未参加 (404) も idempotent に成功扱い */
export async function leaveChannel(token: string, channelId: string): Promise<void> {
  const response = await fetchWithTimeout(`${channelsBaseUrl()}/${channelId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) {
    logger.info('Bot は対象トークルームに居ないため退室は no-op', {
      caller: `${CALLER}.leaveChannel`,
      id: channelId,
    })
    return
  }
  if (!response.ok) await throwUpstream(response, `${CALLER}.leaveChannel`)

  logger.success('トークルームから退室', {
    caller: `${CALLER}.leaveChannel`,
    id: channelId,
  })
}

/**
 * トークルームメンバー一覧を取得する。
 * count / cursor でページング可能。レスポンスの responseMetaData.nextCursor が
 * あれば追加ページが存在するので呼び出し側でループする (本関数は 1 ページ分のみ取得)
 */
export async function listChannelMembers(
  token: string,
  channelId: string,
  query: ListMembersQuery = {},
): Promise<ChannelMembersResult> {
  const url = new URL(`${channelsBaseUrl()}/${channelId}/members`)
  if (query.count !== undefined) url.searchParams.set('count', String(query.count))
  if (query.cursor) url.searchParams.set('cursor', query.cursor)

  const response = await fetchWithTimeout(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.listChannelMembers`)

  return (await response.json()) as ChannelMembersResult
}
