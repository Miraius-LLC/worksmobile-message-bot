import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import { labeledActionSchema, quickReplySchema } from './_schemas'
import { sendMessage } from './_send'

export const buttonTemplateBodySchema = z.object({
  contentText: z.string().min(1),
  actions: z.array(labeledActionSchema).min(1),
  quickReply: quickReplySchema.optional(),
})

export type ButtonTemplateBody = z.infer<typeof buttonTemplateBodySchema>

export const sendButtonTemplateMessage: MessageSender<ButtonTemplateBody> = async (
  botId,
  token,
  target,
  body,
) => {
  await sendMessage(botId, token, target, {
    type: 'button_template',
    contentText: body.contentText,
    actions: body.actions,
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
