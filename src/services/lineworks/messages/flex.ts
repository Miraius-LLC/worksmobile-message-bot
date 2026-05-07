import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import { quickReplySchema } from './_schemas'
import { sendMessage } from './_send'

export const flexBodySchema = z.object({
  altText: z.string().min(1).max(400),
  contents: z.record(z.string(), z.unknown()),
  quickReply: quickReplySchema.optional(),
})

export type FlexBody = z.infer<typeof flexBodySchema>

export const sendFlexMessage: MessageSender<FlexBody> = async (botId, token, target, body) => {
  await sendMessage(botId, token, target, {
    type: 'flex',
    altText: body.altText,
    contents: body.contents,
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
