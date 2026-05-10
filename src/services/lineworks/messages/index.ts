import { z } from 'zod'
import { API_BASE, sendBotMessage } from '@/services/lineworks/api'
import type { MessageTarget } from '@/types/lineworks'

// =============================================================================
// 共通サブスキーマ
// =============================================================================

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'svg',
  'bmp',
  'webp',
  'tif',
  'tiff',
  'ico',
  'icns',
  'psd',
  'ai',
  'clip',
  'heic',
  'rw2',
])

/**
 * URL の形式チェック。WHATWG URL parser ベースで判定する。
 * 旧実装は正規表現 (`^(https?:\/\/)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/\S*)?$`) で
 * ポート番号 (`:8080`) と IPv4 (`192.168.1.1` の末尾数値) が弾かれる回帰があった
 */
function isWebUrl(value: string, opts: { httpsOnly?: boolean } = {}): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  if (opts.httpsOnly) return parsed.protocol === 'https:'
  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
}

/** HTTP / HTTPS の URL (最大 1000 文字) */
const urlSchema = z
  .string()
  .max(1000)
  .refine(v => isWebUrl(v), { message: 'HTTP / HTTPS の URL を指定してください' })

/** HTTPS 限定の URL (最大 1000 文字)。LINE WORKS の `file.originalContentUrl` 等は HTTPS 必須 */
const httpsUrlSchema = z
  .string()
  .max(1000)
  .refine(v => isWebUrl(v, { httpsOnly: true }), {
    message: 'HTTPS の URL を指定してください',
  })

/** 画像 URL: HTTPS 必須 + 拡張子チェック (拡張子なしは許可) */
const imageUrlSchema = z
  .string()
  .max(1000)
  .refine(v => isWebUrl(v, { httpsOnly: true }), {
    message: 'HTTPS の URL を指定してください',
  })
  .refine(
    url => {
      const ext = new URL(url).pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase()
      if (!ext) return true
      return ALLOWED_IMAGE_EXTENSIONS.has(ext)
    },
    { message: '画像の拡張子が許可されていません' },
  )

const ACTION_TYPES = [
  'postback',
  'message',
  'uri',
  'camera',
  'cameraRoll',
  'location',
  'copy',
] as const

/**
 * type に応じた必須フィールドが揃っているか。
 * `.loose()` で未知フィールド (LINE WORKS 固有の `text` 等) を保持する。Zod 4 の
 * z.object() はデフォルトで strip するため、これを付けないと `type: 'message'` の
 * リクエストから `text` が消えて API 側で 400 になる。
 *
 * フィールド命名は LINE WORKS Action Object spec に揃える:
 *  - `data` は postback action の必須フィールド (文字列)
 *  - `displayText` は postback action の任意 (quickReply 内では必須) フィールド
 *  - `postback` は message action の任意フィールド (postback action 自体ではなく、
 *    message action 経由で postback イベントを起こす用途)
 */
const baseAction = z
  .object({
    type: z.enum(ACTION_TYPES),
    label: z.string().min(1).max(20).optional(),
    postback: z.string().min(1).optional(),
    data: z.string().min(1).max(300).optional(),
    displayText: z.string().max(300).optional(),
    uri: z.string().max(1000).optional(),
    copyText: z.string().min(1).max(1000).optional(),
  })
  .loose()
  .refine(
    a => {
      switch (a.type) {
        case 'postback':
          // spec: postback action は `data` 必須 (旧実装は `postback` を見ていたため
          // spec 準拠のリクエストが弾かれる回帰だった)
          return typeof a.data === 'string'
        case 'uri':
          return typeof a.uri === 'string' && isWebUrl(a.uri)
        case 'copy':
          return typeof a.copyText === 'string'
        default:
          return true
      }
    },
    { message: 'action.type に対応する必須プロパティが欠落しています' },
  )

/** デフォルトアクション (label optional) */
const defaultActionSchema = baseAction

/** 通常アクション (label required, max 20 文字) */
const labeledActionSchema = baseAction.refine(
  a => typeof a.label === 'string' && a.label.length > 0,
  { message: 'action.label は必須です' },
)

/** image_carousel 用アクション: label 必須かつ最大 12 文字 (spec 上の特例) */
const imageCarouselActionSchema = labeledActionSchema.refine(
  a => typeof a.label === 'string' && a.label.length <= 12,
  { message: 'image_carousel の action.label は 12 文字以内' },
)

/** クイックリプライ (Bot のメッセージに任意付与, items は最大 13 件) */
const quickReplySchema = z.object({
  items: z
    .array(
      z
        .object({
          imageUrl: httpsUrlSchema.optional(),
          action: labeledActionSchema,
        })
        .loose(),
    )
    .min(1, { message: 'quickReply.items は 1 件以上必要です' })
    .max(13, { message: 'quickReply.items は最大 13 件までです' }),
})

// =============================================================================
// per-type body schemas
// =============================================================================

const textBodySchema = z.object({
  text: z.string().min(1).max(2000),
  quickReply: quickReplySchema.optional(),
})

const stickerBodySchema = z.object({
  packageId: z.string().min(1),
  stickerId: z.string().min(1),
  quickReply: quickReplySchema.optional(),
})

const imageBodySchema = z
  .object({
    previewImageUrl: imageUrlSchema.optional(),
    originalContentUrl: imageUrlSchema.optional(),
    fileId: z.string().min(1).optional(),
    quickReply: quickReplySchema.optional(),
  })
  // spec: previewImageUrl と originalContentUrl は **両方**セット、または fileId 単独。
  // 旧実装はいずれか 1 つで通していたが LINE WORKS 側は preview/original の片方だけだと 400
  .refine(b => (Boolean(b.previewImageUrl) && Boolean(b.originalContentUrl)) || Boolean(b.fileId), {
    message:
      "'previewImageUrl' と 'originalContentUrl' を両方指定するか、'fileId' を指定してください",
  })

const fileBodySchema = z
  .object({
    // spec: file の originalContentUrl は HTTPS のみ受理 (http は LINE WORKS 側で 400)
    originalContentUrl: httpsUrlSchema.optional(),
    fileId: z.string().min(1).optional(),
    quickReply: quickReplySchema.optional(),
  })
  .refine(b => Boolean(b.originalContentUrl || b.fileId), {
    message: "'originalContentUrl' / 'fileId' のいずれかを指定してください",
  })

const linkBodySchema = z.object({
  contentText: z.string().min(1).max(1000),
  linkText: z.string().min(1).max(1000),
  link: urlSchema,
  quickReply: quickReplySchema.optional(),
})

const buttonTemplateBodySchema = z.object({
  contentText: z.string().min(1).max(1000),
  // spec: actions は 1 件以上 / 最大 10 件
  actions: z.array(labeledActionSchema).min(1).max(10),
  quickReply: quickReplySchema.optional(),
})

const listTemplateBodySchema = z.object({
  coverData: z
    .object({
      // spec: title / subtitle は coverData の任意フィールド (各 max 1000 字)
      title: z.string().min(1).max(1000).optional(),
      subtitle: z.string().max(1000).optional(),
      backgroundImageUrl: imageUrlSchema.optional(),
      backgroundFileId: z.string().min(1).optional(),
    })
    .loose()
    .refine(c => !(c.backgroundImageUrl && c.backgroundFileId), {
      message: "'backgroundImageUrl' と 'backgroundFileId' はどちらか一方のみ指定可能",
    })
    .optional(),
  // spec: elements は最大 4 件 (旧実装は max 10 だった)。defaultAction は spec に存在しない
  // ため明示フィールドから外す (`.loose()` でユーザが入れたら素通り、API 側で無視/拒否される)
  elements: z
    .array(
      z
        .object({
          title: z.string().min(1).max(1000),
          subtitle: z.string().max(1000).optional(),
          originalContentUrl: imageUrlSchema.optional(),
          action: labeledActionSchema.optional(),
        })
        .loose(),
    )
    .min(1)
    .max(4),
  /** 全体 actions: 2 次元配列の各要素は label 必須 action */
  actions: z.array(z.array(labeledActionSchema)).optional(),
  quickReply: quickReplySchema.optional(),
})

const carouselBodySchema = z
  .object({
    // spec: enum で固定値のみ受理 (旧実装は任意文字列を許容、誤値で LW 400 になる)
    imageAspectRatio: z.enum(['rectangle', 'square']).default('rectangle'),
    imageSize: z.enum(['cover', 'contain']).default('cover'),
    columns: z
      .array(
        z
          .object({
            originalContentUrl: imageUrlSchema.optional(),
            fileId: z.string().min(1).optional(),
            title: z.string().max(40).optional(),
            text: z.string().min(1),
            defaultAction: defaultActionSchema.optional(),
            // spec: 各 column の actions は 1 件以上 / 最大 3 件
            actions: z.array(labeledActionSchema).min(1).max(3),
          })
          .loose()
          .refine(c => Boolean(c.originalContentUrl || c.fileId), {
            message: "カラムには 'originalContentUrl' または 'fileId' のいずれかが必要",
          })
          .refine(
            c => {
              const max = c.originalContentUrl || c.title ? 60 : 120
              return c.text.length <= max
            },
            {
              message:
                "カラムの 'text' が許容文字数を超えています (画像 / title あり: 60、なし: 120)",
            },
          ),
      )
      .min(1)
      .max(10),
    quickReply: quickReplySchema.optional(),
  })
  // spec: 全 column で actions の件数が同一でなければならない (LINE WORKS 側で強制)
  .refine(
    body => {
      const counts = new Set(body.columns.map(c => c.actions.length))
      return counts.size === 1
    },
    { message: 'carousel: 全 columns の actions 件数を揃えてください' },
  )

const imageCarouselBodySchema = z.object({
  columns: z
    .array(
      z
        .object({
          originalContentUrl: imageUrlSchema.optional(),
          fileId: z.string().min(1).optional(),
          // spec: image_carousel の action.label は最大 12 文字 (他 type より strict)
          action: imageCarouselActionSchema.optional(),
        })
        .loose()
        .refine(c => Boolean(c.originalContentUrl || c.fileId), {
          message: "カラムには 'originalContentUrl' または 'fileId' のいずれかが必要",
        }),
    )
    .min(1)
    .max(10),
  quickReply: quickReplySchema.optional(),
})

const flexBodySchema = z.object({
  altText: z.string().min(1).max(400),
  contents: z.record(z.string(), z.unknown()),
  quickReply: quickReplySchema.optional(),
})

// =============================================================================
// 公開マップ・型・dispatcher
// =============================================================================

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
export type MessageBody<T extends MessageType> = z.infer<(typeof messageSchemas)[T]>

export const messageTypes = Object.keys(messageSchemas) as MessageType[]

function buildMessageUrl(botId: string, target: MessageTarget): string {
  const path =
    'userId' in target ? `users/${target.userId}/messages` : `channels/${target.channelId}/messages`
  return `${API_BASE}/bots/${botId}/${path}`
}

/**
 * type + Zod 検証済 body を `{ type, ...body }` 形に組み立てて Bot API へ送信する
 * 共通 dispatcher。`undefined` フィールドは `JSON.stringify` が落とすので
 * 「optional フィールドは値があれば送る」が自然に成立する。
 */
export async function sendMessageByType<T extends MessageType>(
  botId: string,
  token: string,
  target: MessageTarget,
  type: T,
  body: MessageBody<T>,
): Promise<void> {
  const url = buildMessageUrl(botId, target)
  await sendBotMessage(token, url, { type, ...body })
}
