import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import { quickReplySchema } from './_schemas'
import { sendMessage } from './_send'

export const stickerBodySchema = z.object({
  packageId: z.string().min(1),
  stickerId: z.string().min(1),
  quickReply: quickReplySchema.optional(),
})

export type StickerBody = z.infer<typeof stickerBodySchema>

export const sendStickerMessage: MessageSender<StickerBody> = async (
  botId,
  token,
  target,
  body,
) => {
  await sendMessage(botId, token, target, {
    type: 'sticker',
    packageId: body.packageId,
    stickerId: body.stickerId,
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
