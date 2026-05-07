import { logger } from '@/utils/logger'

const CALLER = 'utils/config'

type RequiredEnv = 'CLIENT_ID' | 'CLIENT_SECRET' | 'SERVICE_ACCOUNT' | 'PRIVATE_KEY' | 'BOT_ID'

type OptionalEnv = 'PORT' | 'NODE_ENV' | 'USE_HTTP2' | 'LOG_PRETTY'

type Config = {
  clientId: string
  clientSecret: string
  serviceAccount: string
  /** Base64 デコード済みの PEM 文字列 */
  privateKey: string
  botId: string
  port: number
  isProduction: boolean
  useHttp2: boolean
  logPretty: boolean
}

let cached: Config | null = null

/**
 * 必須 env を起動時に検証してメモリへロードする。
 * 失敗時は標準エラーへメッセージを出して非 0 終了する (fail-fast)。
 * 一度成功したら 2 回目以降は no-op。
 */
export function load(): Config {
  if (cached) return cached

  const missing: RequiredEnv[] = []
  const required = (name: RequiredEnv): string => {
    const value = process.env[name]
    if (!value) {
      missing.push(name)
      return ''
    }
    return value
  }

  const optional = (name: OptionalEnv): string | undefined => process.env[name] || undefined

  const clientId = required('CLIENT_ID')
  const clientSecret = required('CLIENT_SECRET')
  const serviceAccount = required('SERVICE_ACCOUNT')
  const privateKeyB64 = required('PRIVATE_KEY')
  const botId = required('BOT_ID')

  if (missing.length > 0) {
    logger.failure('必須環境変数が未設定です', {
      caller: `${CALLER}.load`,
      debug: missing,
    })
    process.exit(1)
  }

  let privateKey: string
  try {
    privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf-8')
  } catch (error) {
    logger.failure("環境変数 'PRIVATE_KEY' の Base64 デコードに失敗しました", {
      caller: `${CALLER}.load`,
      error,
    })
    process.exit(1)
  }

  if (!privateKey.includes('PRIVATE KEY')) {
    logger.failure("'PRIVATE_KEY' が PEM 形式ではない可能性があります (Base64 エンコード前提)", {
      caller: `${CALLER}.load`,
    })
    process.exit(1)
  }

  cached = {
    clientId,
    clientSecret,
    serviceAccount,
    privateKey,
    botId,
    port: Number(optional('PORT') ?? 8080),
    isProduction: optional('NODE_ENV') === 'production',
    useHttp2: optional('USE_HTTP2') === '1',
    logPretty: optional('LOG_PRETTY') === '1',
  }
  return cached
}

/**
 * `load()` 後に同期取得するアクセサ。先に `load()` を呼んでいない場合は throw。
 */
export function config(): Config {
  if (!cached) {
    throw new Error('config.load() が呼ばれていません')
  }
  return cached
}
