import { z } from 'zod'
import { API_BASE, getBotId, LineWorksApiError } from '@/services/lineworks/api'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/domain-members'

// =============================================================================
// Zod schema
// =============================================================================

/**
 * 登録時の body: userId 1 件のみ (LINE WORKS の API は 1 ユーザーずつ呼ぶ仕様)。
 * userId はメンバーアカウントの ID or ログイン ID (メールアドレス) のいずれか
 */
export const registerDomainMemberSchema = z.object({
  userId: z.string().min(1),
})

export type RegisterDomainMemberInput = z.infer<typeof registerDomainMemberSchema>

/** ページング query */
export const listDomainMembersQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
})

export type ListDomainMembersQuery = z.infer<typeof listDomainMembersQuerySchema>

// =============================================================================
// レスポンス型
// =============================================================================

export type DomainMembersResult = {
  members: string[]
  responseMetaData?: { nextCursor?: string }
}

// =============================================================================
// HTTP ヘルパ
// =============================================================================

function membersUrl(domainId: string): string {
  return `${API_BASE}/bots/${getBotId()}/domains/${domainId}/members`
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
 * Bot 利用ユーザーをドメインに登録する。
 *
 * spec の注意: API 経由の登録ではユーザーへのサービス通知は送信されない。
 * 同一 Bot に対する操作 API の同時並列呼び出しは避けること。
 */
export async function registerDomainMember(
  token: string,
  domainId: string,
  input: RegisterDomainMemberInput,
): Promise<void> {
  const response = await fetch(membersUrl(domainId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.registerDomainMember`)

  logger.success('ドメインメンバーを登録', {
    caller: `${CALLER}.registerDomainMember`,
    id: input.userId,
  })
}

/**
 * ドメインで Bot を利用できるユーザー一覧を取得する。
 * count / cursor でページング (本関数は 1 ページ分のみ取得)。
 */
export async function listDomainMembers(
  token: string,
  domainId: string,
  query: ListDomainMembersQuery = {},
): Promise<DomainMembersResult> {
  const url = new URL(membersUrl(domainId))
  if (query.count !== undefined) url.searchParams.set('count', String(query.count))
  if (query.cursor) url.searchParams.set('cursor', query.cursor)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.listDomainMembers`)

  return (await response.json()) as DomainMembersResult
}

/** Bot 利用ユーザーをドメインから削除する。未登録 (404) は idempotent に成功扱い */
export async function unregisterDomainMember(
  token: string,
  domainId: string,
  userId: string,
): Promise<void> {
  const response = await fetch(`${membersUrl(domainId)}/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) {
    logger.info('対象ユーザーは未登録のため削除は no-op', {
      caller: `${CALLER}.unregisterDomainMember`,
      id: userId,
    })
    return
  }
  if (!response.ok) await throwUpstream(response, `${CALLER}.unregisterDomainMember`)

  logger.success('ドメインメンバーを削除', {
    caller: `${CALLER}.unregisterDomainMember`,
    id: userId,
  })
}
