import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { attachmentsApp } from '@/routes/attachments'
import { messagesApp } from '@/routes/messages'
import * as config from '@/utils/config'
import { logger } from '@/utils/logger'
import { installJapaneseErrorMap } from '@/utils/zod-locale'

const CALLER = 'index'

// Zod のエラーメッセージを日本語化 (起動時に 1 度だけ)
installJapaneseErrorMap()

// 必須 env を起動時に検証 (失敗すれば即 exit)。以降は config() で同期取得できる
const cfg = config.load()

const app = new Hono()

// X-Frame-Options / X-Content-Type-Options / Strict-Transport-Security 等を一括付与
app.use('*', secureHeaders())

app.get('/', c => c.json({ statusCode: 200, message: 'Server is running' }))
app.get('/health', c => c.json({ status: 'ok' }))

app.route('/', messagesApp)
app.route('/attachments', attachmentsApp)

app.notFound(c => c.json({ error: 'Not Found', path: c.req.url }, 404))

app.onError((error, c) => {
  logger.error('未捕捉エラー', { caller: `${CALLER}.onError`, error })
  return c.json({ error: error.message }, 500)
})

// HTTP/1.1 で listen する。
// Cloud Run のフロントエンド (Envoy) が公開側の HTTP/2 を終端し、コンテナへは
// HTTP/1.1 で渡してくる構成 (`--use-http2` フラグ無し) を前提とする。
// h2c (end-to-end HTTP/2) は Bun / Node の `node:http2` 単独で HTTP/1.1 fallback
// が効かないため不採用。public 側の HTTP/2 は Cloud Run が提供する
const server = serve({ fetch: app.fetch, port: cfg.port }, info => {
  logger.success(
    `Server running on port ${info.port} (HTTP/1.1, NODE_ENV=${cfg.isProduction ? 'production' : 'development'})`,
    { caller: CALLER },
  )
})

// Cloud Run はスケールダウン / 再デプロイ時に SIGTERM を送ってきた後、
// 10 秒程度で SIGKILL を出すため、9 秒で強制終了する保険を入れて
// in-flight リクエストが完了するのを待つ
const SHUTDOWN_FORCE_TIMEOUT_MS = 9_000

function shutdown(signal: NodeJS.Signals): void {
  logger.info(`${signal} 受信、graceful shutdown 開始`, { caller: `${CALLER}.shutdown` })
  const forceExit = setTimeout(() => {
    logger.warn('shutdown タイムアウト、強制終了します', { caller: `${CALLER}.shutdown` })
    process.exit(1)
  }, SHUTDOWN_FORCE_TIMEOUT_MS)
  forceExit.unref()

  server.close(error => {
    if (error) {
      logger.error('shutdown 中にエラー', { caller: `${CALLER}.shutdown`, error })
      process.exit(1)
    }
    logger.success('shutdown 完了', { caller: `${CALLER}.shutdown` })
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
