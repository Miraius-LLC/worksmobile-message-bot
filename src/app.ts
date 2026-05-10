import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { attachmentsApp } from '@/routes/attachments'
import { messagesApp } from '@/routes/messages'
import { LineWorksApiError } from '@/services/lineworks/api'
import { logger } from '@/utils/logger'
import { traceContextMiddleware } from '@/utils/trace'

const CALLER = 'app'

/**
 * 設定済みの Hono アプリ。
 * `src/index.ts` で `serve()` に渡すほか、テストで `app.request(...)` 経由で叩く。
 */
export const app = new Hono()

// `x-cloud-trace-context` を AsyncLocalStorage に保存して以降の logger 呼び出しに自動付与
app.use('*', traceContextMiddleware)

// X-Frame-Options / X-Content-Type-Options / Strict-Transport-Security 等を一括付与
app.use('*', secureHeaders())

app.get('/', c => c.json({ statusCode: 200, message: 'Server is running' }))
app.get('/health', c => c.json({ status: 'ok' }))

app.route('/', messagesApp)
app.route('/attachments', attachmentsApp)

app.notFound(c => c.json({ error: 'Not Found', path: c.req.url }, 404))

app.onError((error, c) => {
  // LINE WORKS upstream が返したステータスは bridge 側のリトライ判定に必要なのでそのまま透過する
  if (error instanceof LineWorksApiError) {
    return c.json({ error: error.message }, error.status as ContentfulStatusCode)
  }
  logger.error('未捕捉エラー', { caller: `${CALLER}.onError`, error })
  return c.json({ error: error.message }, 500)
})
