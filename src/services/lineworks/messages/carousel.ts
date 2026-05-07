import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import {
  defaultActionSchema,
  imageUrlSchema,
  labeledActionSchema,
  quickReplySchema,
} from './_schemas'
import { sendMessage } from './_send'

const columnSchema = z
  .object({
    originalContentUrl: imageUrlSchema.optional(),
    fileId: z.string().min(1).optional(),
    title: z.string().optional(),
    text: z.string().min(1),
    defaultAction: defaultActionSchema.optional(),
    actions: z.array(labeledActionSchema).min(1),
  })
  .refine(c => Boolean(c.originalContentUrl || c.fileId), {
    message: "カラムには 'originalContentUrl' または 'fileId' のいずれかが必要",
  })
  .refine(
    c => {
      const max = c.originalContentUrl || c.title ? 60 : 120
      return c.text.length <= max
    },
    { message: "カラムの 'text' が許容文字数を超えています (画像 / title あり: 60、なし: 120)" },
  )

export const carouselBodySchema = z.object({
  imageAspectRatio: z.string().optional(),
  imageSize: z.string().optional(),
  columns: z.array(columnSchema).min(1).max(10),
  quickReply: quickReplySchema.optional(),
})

export type CarouselBody = z.infer<typeof carouselBodySchema>

export const sendCarouselMessage: MessageSender<CarouselBody> = async (
  botId,
  token,
  target,
  body,
) => {
  await sendMessage(botId, token, target, {
    type: 'carousel',
    imageAspectRatio: body.imageAspectRatio ?? 'rectangle',
    imageSize: body.imageSize ?? 'cover',
    columns: body.columns,
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
