import type { MessageSender } from '@/types/lineworks'
import { validateImageUrl } from '@/utils/validates'
import { sendMessage } from './_send'

export const sendImageMessage: MessageSender = async (botId, token, params) => {
  const { previewImageUrl, originalContentUrl, fileId } = params

  if (![previewImageUrl, originalContentUrl, fileId].some(Boolean)) {
    throw new Error(
      "パラメータ 'previewImageUrl'、'originalContentUrl'、'fileId' のいずれかを指定してください。",
    )
  }

  if (previewImageUrl) validateImageUrl(previewImageUrl, 'previewImageUrl')
  if (originalContentUrl) validateImageUrl(originalContentUrl, 'originalContentUrl')

  await sendMessage(botId, token, params, {
    type: 'image',
    ...(previewImageUrl ? { previewImageUrl } : {}),
    ...(originalContentUrl ? { originalContentUrl } : {}),
    ...(fileId ? { fileId } : {}),
  })
}
