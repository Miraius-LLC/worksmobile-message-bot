import { API_BASE, sendBotMessage } from '@/services/lineworks/api'
import type { MessageRequestParams, MessageTarget } from '@/types/lineworks'
import { validateQuickReply } from '@/utils/validates'

function buildMessageUrl(botId: string, target: MessageTarget): string {
  if (!(target.userId || target.channelId)) {
    throw new Error('送信先が指定されていません (userId または channelId)。')
  }
  const path = target.userId
    ? `users/${target.userId}/messages`
    : `channels/${target.channelId}/messages`
  return `${API_BASE}/bots/${botId}/${path}`
}

function ensureValidQuickReply(quickReply: unknown): void {
  if (!quickReply) return
  if (typeof quickReply !== 'object') {
    throw new Error("パラメータ 'quickReply' はオブジェクト形式で指定してください。")
  }
  try {
    validateQuickReply(quickReply)
  } catch (error) {
    throw new Error(`クイックリプライの検証に失敗しました: ${(error as Error).message}`)
  }
}

/** 各 message/* から呼ぶ共通エントリ */
export async function sendMessage(
  botId: string,
  token: string,
  params: MessageRequestParams,
  content: Record<string, unknown>,
): Promise<void> {
  const url = buildMessageUrl(botId, params)
  ensureValidQuickReply(params.quickReply)
  const payload = params.quickReply ? { ...content, quickReply: params.quickReply } : content
  await sendBotMessage(token, url, payload)
}
