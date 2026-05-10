import { z } from 'zod'
import { logger } from '@/utils/logger'

const CALLER = 'utils/config'

/**
 * デコード済 PEM が `-----BEGIN ... PRIVATE KEY-----` で始まっているか検査。
 * PKCS#8 (`PRIVATE KEY`) / PKCS#1 (`RSA PRIVATE KEY`) のどちらの BEGIN 行にも対応。
 * 旧実装の `includes('PRIVATE KEY')` は `"foo PRIVATE KEY bar"` も通る緩いチェックだった
 */
export function isPemPrivateKey(value: string): boolean {
  return /^-----BEGIN [A-Z ]*PRIVATE KEY-----/m.test(value)
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
  })
  .transform(env => {
    const privateKey = Buffer.from(env.PRIVATE_KEY, 'base64').toString('utf-8')
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
    }
  })

type Config = z.infer<typeof configSchema>

let cached: Config | null = null

/**
 * 必須 env を起動時に検証してメモリへロードする。
 * 失敗時は logger.failure を出して非 0 終了する (fail-fast)。一度成功したら 2 回目以降は no-op
 */
export function load(): Config {
  if (cached) return cached
  const result = configSchema.safeParse(process.env)
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
