import { API_BASE, sendBotMessage } from '@/services/lineworks/api'
import type { MessageTarget } from '@/types/lineworks'

function buildMessageUrl(botId: string, target: MessageTarget): string {
  const path =
    'userId' in target ? `users/${target.userId}/messages` : `channels/${target.channelId}/messages`
  return `${API_BASE}/bots/${botId}/${path}`
}

/** メッセージ API への共通 POST。Zod が完了済の content をそのまま流す */
export async function sendMessage(
  botId: string,
  token: string,
  target: MessageTarget,
  content: Record<string, unknown>,
): Promise<void> {
  const url = buildMessageUrl(botId, target)
  await sendBotMessage(token, url, content)
}
