import type { MessageSender } from '@/types/lineworks'
import { validateStringParam } from '@/utils/validates'
import { sendMessage } from './_send'

export const sendStickerMessage: MessageSender = async (botId, token, params) => {
  validateStringParam(params.packageId, 'packageId')
  validateStringParam(params.stickerId, 'stickerId')

  await sendMessage(botId, token, params, {
    type: 'sticker',
    packageId: params.packageId,
    stickerId: params.stickerId,
  })
}
