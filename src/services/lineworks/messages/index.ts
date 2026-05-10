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
 * `.loose()` で未知フィールド (LINE WORKS 固有の `text` / `data` / `displayText` 等)
 * を保持する。Zod 4 の z.object() はデフォルトで strip するため、これを付けないと
 * `type: 'message'` のリクエストから `text` が消えて API 側で 400 になる
 */
const baseAction = z
  .object({
    type: z.enum(ACTION_TYPES),
    label: z.string().min(1).optional(),
    postback: z.string().min(1).optional(),
    uri: z.string().optional(),
    copyText: z.string().min(1).optional(),
  })
  .loose()
  .refine(
    a => {
      switch (a.type) {
        case 'postback':
          return typeof a.postback === 'string'
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

/** 通常アクション (label required) */
const labeledActionSchema = baseAction.refine(
  a => typeof a.label === 'string' && a.label.length > 0,
  { message: 'action.label は必須です' },
)

/** クイックリプライ (Bot のメッセージに任意付与) */
const quickReplySchema = z.object({
  items: z
    .array(
      z
        .object({
          imageUrl: z
            .string()
            .max(1000)
            .refine(v => isWebUrl(v, { httpsOnly: true }), {
              message: 'imageUrl は HTTPS の URL を指定してください',
            })
            .optional(),
          action: labeledActionSchema,
        })
        .loose(),
    )
    .min(1, { message: 'quickReply.items は 1 件以上必要です' }),
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
  .refine(b => Boolean(b.previewImageUrl || b.originalContentUrl || b.fileId), {
    message: "'previewImageUrl' / 'originalContentUrl' / 'fileId' のいずれかを指定してください",
  })

const fileBodySchema = z
  .object({
    originalContentUrl: urlSchema.optional(),
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
  contentText: z.string().min(1),
  actions: z.array(labeledActionSchema).min(1),
  quickReply: quickReplySchema.optional(),
})

const listTemplateBodySchema = z.object({
  coverData: z
    .object({
      backgroundImageUrl: imageUrlSchema.optional(),
      backgroundFileId: z.string().min(1).optional(),
    })
    .loose()
    .refine(c => !(c.backgroundImageUrl && c.backgroundFileId), {
      message: "'backgroundImageUrl' と 'backgroundFileId' はどちらか一方のみ指定可能",
    })
    .optional(),
  elements: z
    .array(
      z
        .object({
          title: z.string().min(1),
          subtitle: z.string().max(1000).optional(),
          originalContentUrl: imageUrlSchema.optional(),
          defaultAction: defaultActionSchema.optional(),
          action: labeledActionSchema.optional(),
        })
        .loose(),
    )
    .min(1)
    .max(10),
  /** 全体 actions: 2 次元配列の各要素は label 必須 action */
  actions: z.array(z.array(labeledActionSchema)).optional(),
  quickReply: quickReplySchema.optional(),
})

const carouselBodySchema = z.object({
  imageAspectRatio: z.string().default('rectangle'),
  imageSize: z.string().default('cover'),
  columns: z
    .array(
      z
        .object({
          originalContentUrl: imageUrlSchema.optional(),
          fileId: z.string().min(1).optional(),
          title: z.string().optional(),
          text: z.string().min(1),
          defaultAction: defaultActionSchema.optional(),
          actions: z.array(labeledActionSchema).min(1),
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

const imageCarouselBodySchema = z.object({
  columns: z
    .array(
      z
        .object({
          originalContentUrl: imageUrlSchema.optional(),
          fileId: z.string().min(1).optional(),
          action: labeledActionSchema.optional(),
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
