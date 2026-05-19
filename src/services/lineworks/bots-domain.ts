import { z } from 'zod'
import { API_BASE, LineWorksApiError } from '@/services/lineworks/api'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/bots-domain'

// =============================================================================
// Zod schema (ドメイン別 Bot の設定上書き用)
// =============================================================================

/**
 * ドメイン別の Bot 設定。spec ドキュメントは公開済 docs で全フィールド網羅情報が
 * 取り切れていないため、tenant Bot のサブセット (administrators / subadministrators /
 * enableCallback / 各種フィールド) を任意で受け付ける緩めの schema にしてある。
 * 必要に応じてフィールド追加する。
 */
export const botDomainSchema = z
  .object({
    administrators: z.array(z.string()).min(1).max(3),
    subadministrators: z.array(z.string()).max(3).optional(),
    enableCallback: z.boolean().optional(),
    enableGroupJoin: z.boolean().optional(),
  })
  .loose()

export type BotDomainInput = z.infer<typeof botDomainSchema>
export const botDomainPatchSchema = botDomainSchema.partial()
export type BotDomainPatchInput = z.infer<typeof botDomainPatchSchema>

// =============================================================================
// HTTP ヘルパ
// =============================================================================

function domainsUrl(botId: string, domainId?: string): string {
  const base = `${API_BASE}/bots/${botId}/domains`
  return domainId ? `${base}/${domainId}` : base
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

/** Bot を特定のドメインに登録する */
export async function registerBotDomain(
  token: string,
  botId: string,
  domainId: string,
  input: BotDomainInput,
): Promise<void> {
  const response = await fetch(domainsUrl(botId, domainId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.registerBotDomain`)

  logger.success('Bot をドメインに登録', {
    caller: `${CALLER}.registerBotDomain`,
    id: `${botId}/${domainId}`,
  })
}

/** Bot が登録されているドメイン一覧 */
export async function listBotDomains(
  token: string,
  botId: string,
): Promise<{ domains: unknown[] }> {
  const response = await fetch(domainsUrl(botId), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.listBotDomains`)

  const raw = (await response.json()) as { domains?: unknown[] } | unknown[]
  return Array.isArray(raw) ? { domains: raw } : { domains: raw.domains ?? [] }
}

/** ドメイン別 Bot 設定を完全置換 (PUT) */
export async function replaceBotDomain(
  token: string,
  botId: string,
  domainId: string,
  input: BotDomainInput,
): Promise<void> {
  const response = await fetch(domainsUrl(botId, domainId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.replaceBotDomain`)

  logger.success('ドメイン別 Bot 設定を完全置換', {
    caller: `${CALLER}.replaceBotDomain`,
    id: `${botId}/${domainId}`,
  })
}

/** ドメイン別 Bot 設定を部分更新 (PATCH) */
export async function patchBotDomain(
  token: string,
  botId: string,
  domainId: string,
  input: BotDomainPatchInput,
): Promise<void> {
  const response = await fetch(domainsUrl(botId, domainId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) await throwUpstream(response, `${CALLER}.patchBotDomain`)

  logger.success('ドメイン別 Bot 設定を部分更新', {
    caller: `${CALLER}.patchBotDomain`,
    id: `${botId}/${domainId}`,
  })
}

/** Bot をドメインから削除 (未登録は idempotent) */
export async function deleteBotDomain(
  token: string,
  botId: string,
  domainId: string,
): Promise<void> {
  const response = await fetch(domainsUrl(botId, domainId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) {
    logger.info('Bot は対象ドメインに登録されていないため削除は no-op', {
      caller: `${CALLER}.deleteBotDomain`,
      id: `${botId}/${domainId}`,
    })
    return
  }
  if (!response.ok) await throwUpstream(response, `${CALLER}.deleteBotDomain`)

  logger.success('Bot をドメインから削除', {
    caller: `${CALLER}.deleteBotDomain`,
    id: `${botId}/${domainId}`,
  })
}
