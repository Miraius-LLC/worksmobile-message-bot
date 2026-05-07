import type { MessageSender } from '@/types/lineworks'
import { validateStringParam, validateUrl } from '@/utils/validates'
import { sendMessage } from './_send'

export const sendLinkMessage: MessageSender = async (botId, token, params) => {
  const { contentText, linkText, link } = params

  validateStringParam(contentText, 'contentText', 1000)
  validateStringParam(linkText, 'linkText', 1000)
  validateUrl(link, 'link', 1000)

  await sendMessage(botId, token, params, {
    type: 'link',
    contentText,
    linkText,
    link,
  })
}
