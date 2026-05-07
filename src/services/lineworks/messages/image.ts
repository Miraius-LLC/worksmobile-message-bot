import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import { imageUrlSchema, quickReplySchema } from './_schemas'
import { sendMessage } from './_send'

export const imageBodySchema = z
  .object({
    previewImageUrl: imageUrlSchema.optional(),
    originalContentUrl: imageUrlSchema.optional(),
    fileId: z.string().min(1).optional(),
    quickReply: quickReplySchema.optional(),
  })
  .refine(b => Boolean(b.previewImageUrl || b.originalContentUrl || b.fileId), {
    message: "'previewImageUrl' / 'originalContentUrl' / 'fileId' のいずれかを指定してください",
  })

export type ImageBody = z.infer<typeof imageBodySchema>

export const sendImageMessage: MessageSender<ImageBody> = async (botId, token, target, body) => {
  await sendMessage(botId, token, target, {
    type: 'image',
    ...(body.previewImageUrl ? { previewImageUrl: body.previewImageUrl } : {}),
    ...(body.originalContentUrl ? { originalContentUrl: body.originalContentUrl } : {}),
    ...(body.fileId ? { fileId: body.fileId } : {}),
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
