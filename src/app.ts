import { Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { attachmentsApp } from '@/routes/attachments'
import { callbackApp } from '@/routes/callback'
import { channelsApp } from '@/routes/channels'
import { domainsApp } from '@/routes/domains'
import { persistentMenuApp } from '@/routes/menus/persistent'
import { richMenuApp } from '@/routes/menus/rich'
import { messagesApp } from '@/routes/messages'
import { LineWorksApiError } from '@/services/lineworks/api'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'
import { traceContextMiddleware } from '@/utils/trace'

const CALLER = 'app'

/** BASIC 認証を適用しないパス (Cloud Run の health probe / Docker HEALTHCHECK / k8s probe 用) */
const HEALTH_PATHS = ['/healthz', '/health', '/readyz', '/livez'] as const
/**
 * `/callback` は LINE WORKS から直接叩かれるため BASIC 認証は適用せず、
 * `X-WORKS-Signature` (HMAC-SHA256 with BOT_SECRET) で真正性を担保する。
 * 検証ロジックは `routes/callback.ts` 側で実施する
 */
const PUBLIC_PATHS = new Set<string>(['/', '/callback', ...HEALTH_PATHS])

/**
 * BASIC 認証ミドルウェアを遅延初期化する。
 * `app.ts` は import 時に評価されるが `config()` は `config.load()` 後にしか
 * 呼べないため、最初のリクエスト時に組み立てて以降キャッシュする。
 */
let _authMiddleware: ReturnType<typeof basicAuth> | undefined
function getAuthMiddleware(): ReturnType<typeof basicAuth> {
  if (_authMiddleware) return _authMiddleware
  const cfg = config()
  _authMiddleware = basicAuth({
    username: cfg.basicAuthUsername,
    password: cfg.basicAuthPassword,
  })
  return _authMiddleware
}

/**
 * 設定済みの Hono アプリ。
 * `src/index.ts` で `serve()` に渡すほか、テストで `app.request(...)` 経由で叩く。
 */
export const app = new Hono()

// `x-cloud-trace-context` を AsyncLocalStorage に保存して以降の logger 呼び出しに自動付与
app.use('*', traceContextMiddleware)

// X-Frame-Options / X-Content-Type-Options / Strict-Transport-Security 等を一括付与
app.use('*', secureHeaders())

// `/` と health probe 系パス (`/healthz` / `/health` / `/readyz` / `/livez`)
// 以外の全リクエストに BASIC 認証を要求する。
// webhook 公開エンドポイントを保護するための最低限の認証で、credentials は
// Secret Manager から `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` で注入する。
app.use('*', async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next()
  return getAuthMiddleware()(c, next)
})

app.get('/', c => c.json({ statusCode: 200, message: 'Server is running' }))
// health probe は `/healthz` を正としつつ、互換のため `/health` / `/readyz` / `/livez`
// も同じハンドラで 200 OK を返す。複数オーケストレータ (Cloud Run / k8s 風) を跨げるよう揃えている
for (const path of HEALTH_PATHS) {
  app.get(path, c => c.json({ status: 'ok' }))
}

app.route('/', messagesApp)
app.route('/attachments', attachmentsApp)
app.route('/callback', callbackApp)
app.route('/menus/persistent', persistentMenuApp)
app.route('/menus/rich', richMenuApp)
app.route('/channels', channelsApp)
app.route('/domains', domainsApp)

app.notFound(c => c.json({ error: 'Not Found', path: c.req.url }, 404))

app.onError((error, c) => {
  // LINE WORKS upstream が返したステータスは bridge 側のリトライ判定に必要なのでそのまま透過する。
  // code (upstream の Error code) と hint (typical 原因の日本語説明) も含めて
  // クライアントが原因を切り分けやすくする
  if (error instanceof LineWorksApiError) {
    return c.json(
      { error: error.message, code: error.code, hint: error.hint },
      error.status as ContentfulStatusCode,
    )
  }
  // basicAuth ミドルウェア等が投げる HTTPException は Hono の標準ハンドリングを尊重する
  // (401 + WWW-Authenticate ヘッダ等)。app.onError を定義すると HTTPException も
  // ここを通るため、`getResponse()` で本来のレスポンスを取り出す必要がある
  if (error instanceof HTTPException) {
    return error.getResponse()
  }
  logger.error('未捕捉エラー', { caller: `${CALLER}.onError`, error })
  return c.json({ error: error.message }, 500)
})
