import { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import {
  defaultActionSchema,
  imageUrlSchema,
  labeledActionSchema,
  quickReplySchema,
} from './_schemas'
import { sendMessage } from './_send'

const coverDataSchema = z
  .object({
    backgroundImageUrl: imageUrlSchema.optional(),
    backgroundFileId: z.string().min(1).optional(),
  })
  .refine(c => !(c.backgroundImageUrl && c.backgroundFileId), {
    message: "'backgroundImageUrl' と 'backgroundFileId' はどちらか一方のみ指定可能",
  })

const elementSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().max(1000).optional(),
  originalContentUrl: imageUrlSchema.optional(),
  defaultAction: defaultActionSchema.optional(),
  action: labeledActionSchema.optional(),
})

export const listTemplateBodySchema = z.object({
  coverData: coverDataSchema.optional(),
  elements: z.array(elementSchema).min(1).max(10),
  /** 全体 actions: 2 次元配列の各要素は label 必須 action */
  actions: z.array(z.array(labeledActionSchema)).optional(),
  quickReply: quickReplySchema.optional(),
})

export type ListTemplateBody = z.infer<typeof listTemplateBodySchema>

export const sendListTemplateMessage: MessageSender<ListTemplateBody> = async (
  botId,
  token,
  target,
  body,
) => {
  await sendMessage(botId, token, target, {
    type: 'list_template',
    ...(body.coverData ? { coverData: body.coverData } : {}),
    elements: body.elements,
    ...(body.actions ? { actions: body.actions } : {}),
    ...(body.quickReply ? { quickReply: body.quickReply } : {}),
  })
}
