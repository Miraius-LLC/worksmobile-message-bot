import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import { quickReplySchema, urlSchema } from './_schemas'
import { sendMessage } from './_send'

export const linkBodySchema = z.object({
  contentText: z.string().min(1).max(1000),
  linkText: z.string().min(1).max(1000),
  link: urlSchema,
  quickReply: quickReplySchema.optional(),
})

export type LinkBody = z.infer<typeof linkBodySchema>

export const sendLinkMessage: MessageSender<LinkBody> = async (botId, token, target, body) => {
  await sendMessage(botId, token, target, {
    type: 'link',
    contentText: body.contentText,
    linkText: body.linkText,
    link: body.link,
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
