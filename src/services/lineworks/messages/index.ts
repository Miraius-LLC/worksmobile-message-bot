import type { MessageSender } from '@/types/lineworks'
import { sendButtonTemplateMessage } from './buttonTemplate'
import { sendCarouselMessage } from './carousel'
import { sendFileMessage } from './file'
import { sendFlexMessage } from './flex'
import { sendImageMessage } from './image'
import { sendImageCarouselMessage } from './imageCarousel'
import { sendLinkMessage } from './link'
import { sendListTemplateMessage } from './listTemplate'
import { sendStickerMessage } from './sticker'
import { sendTextMessage } from './text'

/** README に列挙された URL の `type` 部分 → 送信関数 のマップ */
export const messageSenders = {
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
} as const satisfies Record<string, MessageSender>

export type MessageType = keyof typeof messageSenders

export const messageTypes = Object.keys(messageSenders) as MessageType[]
