import { createServer as createHttp2Server } from 'node:http2'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { attachmentsApp } from '@/routes/attachments'
import { messagesApp } from '@/routes/messages'
import { logger } from '@/utils/logger'

const CALLER = 'index'

const PORT = Number(process.env['PORT'] ?? 8080)
const useHttp2 = process.env['USE_HTTP2'] === '1'

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
const serveOptions = useHttp2
  ? { fetch: app.fetch, port: PORT, createServer: createHttp2Server }
  : { fetch: app.fetch, port: PORT }

serve(serveOptions, info => {
  logger.success(
    `Server running on port ${info.port} (HTTP/${useHttp2 ? '2 h2c' : '1.1'}, NODE_ENV=${process.env['NODE_ENV']})`,
    { caller: CALLER },
  )
})
