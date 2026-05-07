import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/api'

export const API_BASE = 'https://www.worksapis.com/v1.0'

/**
 * LINE WORKS Bot API がエラーステータスを返したことを示す例外。
 * `app.onError` がこの型を見て upstream の HTTP ステータスをそのまま返すので、
 * 呼び出し側 (IFTTT / Make 等の bridge) のリトライ判定 (4xx は retry しない / 5xx は retry) が正しく効く
 */
export class LineWorksApiError extends Error {
  readonly status: number
  readonly upstreamBody: string

  constructor(status: number, upstreamBody: string) {
    super(`LINE WORKS API の呼び出しに失敗しました (status=${status})`)
    this.name = 'LineWorksApiError'
    this.status = status
    this.upstreamBody = upstreamBody
  }
}

export function getBotId(): string {
  return config().botId
}

/** Bot API への JSON POST。失敗時はステータスとボディをログに出して throw する */
export async function postJson(token: string, url: string, data: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    logger.error('LINE WORKS API 呼び出しに失敗', {
      caller: `${CALLER}.postJson`,
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
