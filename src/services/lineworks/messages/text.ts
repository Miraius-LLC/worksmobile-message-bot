import type { MessageSender } from '@/types/lineworks'
import { validateStringParam } from '@/utils/validates'
import { sendMessage } from './_send'

export const sendTextMessage: MessageSender = async (botId, token, params) => {
  validateStringParam(params.text, 'text', 2000)
  await sendMessage(botId, token, params, {
    type: 'text',
    text: params.text,
  })
}
