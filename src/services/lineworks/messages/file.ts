import type { MessageSender } from '@/types/lineworks'
import { validateUrl } from '@/utils/validates'
import { sendMessage } from './_send'

export const sendFileMessage: MessageSender = async (botId, token, params) => {
  const { originalContentUrl, fileId } = params

  if (!(originalContentUrl || fileId)) {
    throw new Error(
      "パラメータ 'originalContentUrl' または 'fileId' のいずれかを指定してください。",
    )
  }

  if (originalContentUrl) {
    validateUrl(originalContentUrl, 'originalContentUrl', 1000)
  }

  await sendMessage(botId, token, params, {
    type: 'file',
    ...(originalContentUrl ? { originalContentUrl } : {}),
    ...(fileId ? { fileId } : {}),
  })
}
