import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import { quickReplySchema } from './_schemas'
import { sendMessage } from './_send'

export const textBodySchema = z.object({
  text: z.string().min(1).max(2000),
  quickReply: quickReplySchema.optional(),
})

export type TextBody = z.infer<typeof textBodySchema>

export const sendTextMessage: MessageSender<TextBody> = async (botId, token, target, body) => {
  await sendMessage(botId, token, target, {
    type: 'text',
    text: body.text,
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
