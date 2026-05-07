import { z } from 'zod'

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

const URL_REGEX = /^(https?:\/\/)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/\S*)?$/
const HTTPS_REGEX = /^https:\/\//

/** HTTP / HTTPS の URL (最大 1000 文字) */
export const urlSchema = z.string().max(1000).regex(URL_REGEX, {
  message: 'HTTP / HTTPS の URL を指定してください',
})

/** 画像 URL: HTTPS 必須 + 拡張子チェック (拡張子なしは許可) */
export const imageUrlSchema = z
  .string()
  .max(1000)
  .regex(URL_REGEX, { message: 'URL の形式が不正です' })
  .regex(HTTPS_REGEX, { message: 'HTTPS の URL を指定してください' })
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

/** type に応じた必須フィールドが揃っているか */
const baseAction = z
  .object({
    type: z.enum(ACTION_TYPES),
    label: z.string().min(1).optional(),
    postback: z.string().min(1).optional(),
    uri: z.string().optional(),
    copyText: z.string().min(1).optional(),
  })
  .refine(
    a => {
      switch (a.type) {
        case 'postback':
          return typeof a.postback === 'string'
        case 'uri':
          return typeof a.uri === 'string' && URL_REGEX.test(a.uri)
        case 'copy':
          return typeof a.copyText === 'string'
        default:
          return true
      }
    },
    { message: 'action.type に対応する必須プロパティが欠落しています' },
  )

/** デフォルトアクション (label optional) */
export const defaultActionSchema = baseAction

/** 通常アクション (label required) */
export const labeledActionSchema = baseAction.refine(
  a => typeof a.label === 'string' && a.label.length > 0,
  { message: 'action.label は必須です' },
)

/** クイックリプライ (Bot のメッセージに任意付与) */
export const quickReplySchema = z.object({
  items: z
    .array(
      z.object({
        imageUrl: z
          .string()
          .max(1000)
          .regex(HTTPS_REGEX, { message: 'imageUrl は HTTPS の URL を指定してください' })
          .optional(),
        action: labeledActionSchema,
      }),
    )
    .min(1, { message: 'quickReply.items は 1 件以上必要です' }),
})

export type QuickReply = z.infer<typeof quickReplySchema>
