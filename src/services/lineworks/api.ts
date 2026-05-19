import { fetchWithTimeout } from '@/services/lineworks/_fetch'
import { getErrorHint } from '@/services/lineworks/error-hints'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/api'

export const API_BASE = 'https://www.worksapis.com/v1.0'

/**
 * LINE WORKS Bot API がエラーステータスを返したことを示す例外。
 * `app.onError` がこの型を見て upstream の HTTP ステータスをそのまま返すので、
 * 呼び出し側 (IFTTT / Make 等の bridge) のリトライ判定 (4xx は retry しない / 5xx は retry) が正しく効く。
 *
 * constructor は upstream body を JSON parse して `code` を抽出し、`error-hints.ts` の
 * マッピングから日本語 `hint` を組み立てる (Bot ダッシュボードの設定漏れ等の典型原因を
 * クライアント側で切り分けやすくするため)。code 抽出失敗時は body をそのまま保持
 */
export class LineWorksApiError extends Error {
  readonly status: number
  readonly upstreamBody: string
  readonly code: string | undefined
  readonly description: string | undefined
  readonly hint: string | undefined

  constructor(status: number, upstreamBody: string) {
    const { code, description } = parseUpstream(upstreamBody)
    const hint = getErrorHint(code)
    const detailParts = [code ? `code=${code}` : null, description].filter((s): s is string =>
      Boolean(s),
    )
    const detail = detailParts.length > 0 ? ` ${detailParts.join(' / ')}` : ''
    super(`LINE WORKS API の呼び出しに失敗しました (status=${status})${detail}`)
    this.name = 'LineWorksApiError'
    this.status = status
    this.upstreamBody = upstreamBody
    this.code = code
    this.description = description
    this.hint = hint
  }
}

/** upstream body を JSON として parse して code / description を抽出 (失敗時は undefined) */
function parseUpstream(body: string): { code?: string; description?: string } {
  if (!body) return {}
  try {
    const parsed = JSON.parse(body) as { code?: unknown; description?: unknown }
    return {
      code: typeof parsed.code === 'string' ? parsed.code : undefined,
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
    }
  } catch {
    return {}
  }
}

export function getBotId(): string {
  return config().botId
}

/** Bot API への JSON POST。失敗時はステータスとボディをログに出して throw する */
export async function postJson(token: string, url: string, data: unknown): Promise<unknown> {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    // 5xx は本物のサービス障害 (error)、4xx はクライアント payload 不備で運用 alert に乗せたくない (warn)。
    // ACCESS_DENIED (Bot がチャンネルから退室) だけは管理画面側の対応が要るので、
    // 専用 caller で log-based metric から拾えるようにする
    const isAccessDenied = /"ACCESS_DENIED"/.test(body)
    const level: 'error' | 'warn' = response.status >= 500 ? 'error' : 'warn'
    const caller = isAccessDenied ? `${CALLER}.postJson.botKicked` : `${CALLER}.postJson`
    logger[level]('LINE WORKS API 呼び出しに失敗', {
      caller,
      url,
      status: response.status,
      debug: body,
    })
    throw new LineWorksApiError(response.status, body)
  }

  // body が空の場合があるので JSON 解析失敗は無視
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** メッセージ送信の共通呼び出し (content + quickReply は呼び出し側で組み立て済み) */
export async function sendBotMessage(
  token: string,
  url: string,
  content: Record<string, unknown>,
): Promise<void> {
  await postJson(token, url, { content })
  logger.success('メッセージを送信', { caller: `${CALLER}.sendBotMessage`, url })
}
