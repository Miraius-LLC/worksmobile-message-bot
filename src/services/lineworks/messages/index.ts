import type { z } from 'zod'
import type { MessageSender } from '@/types/lineworks'
import { buttonTemplateBodySchema, sendButtonTemplateMessage } from './buttonTemplate'
import { carouselBodySchema, sendCarouselMessage } from './carousel'
import { fileBodySchema, sendFileMessage } from './file'
import { flexBodySchema, sendFlexMessage } from './flex'
import { imageBodySchema, sendImageMessage } from './image'
import { imageCarouselBodySchema, sendImageCarouselMessage } from './imageCarousel'
import { linkBodySchema, sendLinkMessage } from './link'
import { listTemplateBodySchema, sendListTemplateMessage } from './listTemplate'
import { sendStickerMessage, stickerBodySchema } from './sticker'
import { sendTextMessage, textBodySchema } from './text'

/** README に列挙された URL の `type` 部分 → Zod schema のマップ */
export const messageSchemas = {
  text: textBodySchema,
  sticker: stickerBodySchema,
  image: imageBodySchema,
  file: fileBodySchema,
  link: linkBodySchema,
  button_template: buttonTemplateBodySchema,
  list_template: listTemplateBodySchema,
  carousel: carouselBodySchema,
  image_carousel: imageCarouselBodySchema,
  flex: flexBodySchema,
} as const

export type MessageType = keyof typeof messageSchemas

/** type → schema から導出される body 型 */
export type MessageBody<T extends MessageType> = z.infer<(typeof messageSchemas)[T]>

/** type → 送信関数のマップ。各 sender の body 型は schema 由来 */
type SendersMap = { [K in MessageType]: MessageSender<MessageBody<K>> }

export const messageSenders: SendersMap = {
  text: sendTextMessage,
  sticker: sendStickerMessage,
  image: sendImageMessage,
  file: sendFileMessage,
  link: sendLinkMessage,
  button_template: sendButtonTemplateMessage,
  list_template: sendListTemplateMessage,
  carousel: sendCarouselMessage,
  image_carousel: sendImageCarouselMessage,
  flex: sendFlexMessage,
}

export const messageTypes = Object.keys(messageSchemas) as MessageType[]
