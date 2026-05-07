import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import { quickReplySchema, urlSchema } from './_schemas'
import { sendMessage } from './_send'

export const fileBodySchema = z
  .object({
    originalContentUrl: urlSchema.optional(),
    fileId: z.string().min(1).optional(),
    quickReply: quickReplySchema.optional(),
  })
  .refine(b => Boolean(b.originalContentUrl || b.fileId), {
    message: "'originalContentUrl' / 'fileId' のいずれかを指定してください",
  })

export type FileBody = z.infer<typeof fileBodySchema>

export const sendFileMessage: MessageSender<FileBody> = async (botId, token, target, body) => {
  await sendMessage(botId, token, target, {
    type: 'file',
    ...(body.originalContentUrl ? { originalContentUrl: body.originalContentUrl } : {}),
    ...(body.fileId ? { fileId: body.fileId } : {}),
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
