import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import { imageUrlSchema, labeledActionSchema, quickReplySchema } from './_schemas'
import { sendMessage } from './_send'

const columnSchema = z
  .object({
    originalContentUrl: imageUrlSchema.optional(),
    fileId: z.string().min(1).optional(),
    action: labeledActionSchema.optional(),
  })
  .refine(c => Boolean(c.originalContentUrl || c.fileId), {
    message: "カラムには 'originalContentUrl' または 'fileId' のいずれかが必要",
  })

export const imageCarouselBodySchema = z.object({
  columns: z.array(columnSchema).min(1).max(10),
  quickReply: quickReplySchema.optional(),
})

export type ImageCarouselBody = z.infer<typeof imageCarouselBodySchema>

export const sendImageCarouselMessage: MessageSender<ImageCarouselBody> = async (
  botId,
  token,
  target,
  body,
) => {
  await sendMessage(botId, token, target, {
    type: 'image_carousel',
    columns: body.columns,
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
