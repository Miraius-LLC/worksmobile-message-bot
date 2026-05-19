import { z } from 'zod'

/**
 * LINE WORKS Bot Callback の Zod schema 群。
 *
 * 公式 docs: https://developers.worksmobile.com/jp/docs/bot-callback
 *
 * 8 event type を `discriminatedUnion('type', ...)` で結合し、route 層では
 * `callbackEventSchema.safeParse(json)` 1 回で型ごと検証する。
 *
 * `source` の構成が event 種別ごとに違うので注意:
 *  - message:        userId + channelId? + domainId (1:1 トークでは channelId なし)
 *  - postback:       userId + channelId + domainId
 *  - join / leave:   channelId + domainId のみ (Bot 自体の出入りなので userId 不要)
 *  - joined / left:  channelId + domainId のみ + 新規 / 退出メンバー一覧 (`members`)
 *  - begin / end:    userId + channelId + domainId (1:1 トーク開始 / 終了)
 */

// =============================================================================
// メッセージコンテンツ (message イベント内の content)
// =============================================================================

const textContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  /** ボタンテンプレート等から送信された場合の postback パラメータ */
  postback: z.string().optional(),
})

const locationContentSchema = z.object({
  type: z.literal('location'),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
})

const stickerContentSchema = z.object({
  type: z.literal('sticker'),
  packageId: z.string(),
  stickerId: z.string(),
})

const fileLikeContentSchema = z.object({
  type: z.enum(['image', 'file', 'audio', 'video']),
  fileId: z.string(),
})

/**
 * 上記 4 種以外の未知 content type を受け取れる fallback。
 * LINE WORKS が将来新 type を追加した場合に検証で落とさないため、
 * `type: string` だけ確認して残りは passthrough する。
 */
const unknownContentSchema = z.looseObject({
  type: z.string(),
})

/** message.content の union。先に既知 schema をマッチさせ、最後に unknown を fallback */
export const messageContentSchema = z.union([
  textContentSchema,
  locationContentSchema,
  stickerContentSchema,
  fileLikeContentSchema,
  unknownContentSchema,
])

export type MessageContent = z.infer<typeof messageContentSchema>

// =============================================================================
// source (送信元情報) — event 種別ごとに 3 パターン
// =============================================================================

/** message 用: userId 必須 + channelId は 1:1 トークでは未送信なので optional */
const sourceMessageSchema = z.object({
  userId: z.string(),
  channelId: z.string().optional(),
  domainId: z.number(),
})

/** join / leave / joined / left 用: channelId + domainId のみ (Bot or メンバーの出入り) */
const sourceChannelSchema = z.object({
  channelId: z.string(),
  domainId: z.number(),
})

/** postback / begin / end 用: userId + channelId + domainId 全部必須 */
const sourceFullSchema = z.object({
  userId: z.string(),
  channelId: z.string(),
  domainId: z.number(),
})

// =============================================================================
// 8 event schema
// =============================================================================

export const messageEventSchema = z.object({
  type: z.literal('message'),
  source: sourceMessageSchema,
  issuedTime: z.string(),
  content: messageContentSchema,
})

export const postbackEventSchema = z.object({
  type: z.literal('postback'),
  source: sourceFullSchema,
  issuedTime: z.string(),
  data: z.string(),
})

export const joinEventSchema = z.object({
  type: z.literal('join'),
  source: sourceChannelSchema,
  issuedTime: z.string(),
})

export const leaveEventSchema = z.object({
  type: z.literal('leave'),
  source: sourceChannelSchema,
  issuedTime: z.string(),
})

export const joinedEventSchema = z.object({
  type: z.literal('joined'),
  source: sourceChannelSchema,
  issuedTime: z.string(),
  members: z.array(z.string()),
})

export const leftEventSchema = z.object({
  type: z.literal('left'),
  source: sourceChannelSchema,
  issuedTime: z.string(),
  members: z.array(z.string()),
})

export const beginEventSchema = z.object({
  type: z.literal('begin'),
  source: sourceFullSchema,
  issuedTime: z.string(),
})

export const endEventSchema = z.object({
  type: z.literal('end'),
  source: sourceFullSchema,
  issuedTime: z.string(),
})

// =============================================================================
// 統合 discriminatedUnion + 型 export
// =============================================================================

/** LINE WORKS から届く 8 種類の callback event の union schema */
export const callbackEventSchema = z.discriminatedUnion('type', [
  messageEventSchema,
  postbackEventSchema,
  joinEventSchema,
  leaveEventSchema,
  joinedEventSchema,
  leftEventSchema,
  beginEventSchema,
  endEventSchema,
])

export type CallbackEvent = z.infer<typeof callbackEventSchema>
export type CallbackEventType = CallbackEvent['type']

/** event type 名一覧 (dispatcher の map key 列挙 / 横断テスト用) */
export const callbackEventTypes = [
  'message',
  'postback',
  'join',
  'leave',
  'joined',
  'left',
  'begin',
  'end',
] as const satisfies readonly CallbackEventType[]
