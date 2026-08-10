import { z } from 'zod'
import { logger } from '@/utils/logger'

const CALLER = 'utils/config'

export interface RuntimeEnv {
  CLIENT_ID: string
  CLIENT_SECRET: string
  SERVICE_ACCOUNT: string
  PRIVATE_KEY: string
  BOT_ID: string
  BASIC_ID: string
  BASIC_PASS: string
  BOT_SECRET: string
  FORWARD_CALLBACK_URL?: string
  PORT?: string
  NODE_ENV?: string
  LOG_PRETTY?: string
}

/**
 * デコード済 PEM が `-----BEGIN ... PRIVATE KEY-----` で始まっているか検査。
 * PKCS#8 (`PRIVATE KEY`) / PKCS#1 (`RSA PRIVATE KEY`) のどちらの BEGIN 行にも対応。
 * 旧実装の `includes('PRIVATE KEY')` は `"foo PRIVATE KEY bar"` も通る緩いチェックだった
 */
export function isPemPrivateKey(value: string): boolean {
  return /^-----BEGIN [A-Z ]*PRIVATE KEY-----/m.test(value)
}

export function decodeBase64Utf8(value: string): string {
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const configSchema = z
  .object({
    CLIENT_ID: z.string().min(1),
    CLIENT_SECRET: z.string().min(1),
    SERVICE_ACCOUNT: z.string().min(1),
    /** Base64 エンコード済みプライベートキー */
    PRIVATE_KEY: z.string().min(1),
    BOT_ID: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(8080),
    NODE_ENV: z.string().default('development'),
    LOG_PRETTY: z.literal('1').optional(),
    /** webhook 公開エンドポイント保護用の BASIC 認証クレデンシャル */
    BASIC_ID: z.string().min(1),
    BASIC_PASS: z.string().min(1),
    /**
     * LINE WORKS Bot Callback の署名検証用 Bot Secret。
     * Developer Console > Bot 詳細から取得した値をそのまま入れる (Base64 等のデコードは不要)
     */
    BOT_SECRET: z.string().min(1),
    /** 受信したCallbackを転送する任意のupstream URL。未設定なら転送しない。 */
    FORWARD_CALLBACK_URL: z
      .union([z.string().url(), z.literal('')])
      .optional()
      .transform(value => value || undefined),
  })
  .transform(env => {
    const privateKey = decodeBase64Utf8(env.PRIVATE_KEY)
    if (!isPemPrivateKey(privateKey)) {
      throw new Error("'PRIVATE_KEY' が PEM 形式ではない可能性があります (Base64 エンコード前提)")
    }
    return {
      clientId: env.CLIENT_ID,
      clientSecret: env.CLIENT_SECRET,
      serviceAccount: env.SERVICE_ACCOUNT,
      privateKey,
      botId: env.BOT_ID,
      port: env.PORT,
      isProduction: env.NODE_ENV === 'production',
      logPretty: env.LOG_PRETTY === '1',
      basicAuthUsername: env.BASIC_ID,
      basicAuthPassword: env.BASIC_PASS,
      botSecret: env.BOT_SECRET,
      forwardCallbackUrl: env.FORWARD_CALLBACK_URL,
    }
  })

export type Config = z.infer<typeof configSchema>

export function parseConfig(env: RuntimeEnv): Config {
  return configSchema.parse(env)
}

let cached: Config | null = null

/**
 * 必須 env を起動時に検証してメモリへロードする。
 * 失敗時は logger.failure を出して非 0 終了する (fail-fast)。一度成功したら 2 回目以降は no-op
 */
export function load(env: RuntimeEnv | NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached
  const result = configSchema.safeParse(env)
  if (!result.success) {
    logger.failure('環境変数の検証に失敗', {
      caller: `${CALLER}.load`,
      debug: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    })
    process.exit(1)
  }
  cached = result.data
  return cached
}

/** `load()` 後に同期取得するアクセサ。先に `load()` を呼んでいない場合は throw */
export function config(): Config {
  if (!cached) {
    throw new Error('config.load() が呼ばれていません')
  }
  return cached
}
