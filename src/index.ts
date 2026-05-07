import { createServer as createHttp2Server } from 'node:http2'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
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

app.get('/', c => c.json({ statusCode: 200, message: 'Server is running' }))
app.get('/health', c => c.json({ status: 'ok' }))

app.route('/', messagesApp)
app.route('/attachments', attachmentsApp)

app.notFound(c => c.json({ error: 'Not Found', path: c.req.url }, 404))

app.onError((error, c) => {
  logger.error('未捕捉エラー', { caller: `${CALLER}.onError`, error })
  return c.json({ error: error.message }, 500)
})

// HTTP/2 (h2c) は Cloud Run の `--use-http2` end-to-end 用。フラグ未設定の Cloud Run へ
// h2c で起動するとフロントエンド (HTTP/1.1) からのリクエストを全拒否するので
// `USE_HTTP2=1` を明示した時だけ ON にする。
const serveOptions = cfg.useHttp2
  ? { fetch: app.fetch, port: cfg.port, createServer: createHttp2Server }
  : { fetch: app.fetch, port: cfg.port }

serve(serveOptions, info => {
  logger.success(
    `Server running on port ${info.port} (HTTP/${cfg.useHttp2 ? '2 h2c' : '1.1'}, NODE_ENV=${cfg.isProduction ? 'production' : 'development'})`,
    { caller: CALLER },
  )
})
