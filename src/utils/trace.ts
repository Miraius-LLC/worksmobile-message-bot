import { AsyncLocalStorage } from 'node:async_hooks'
import type { MiddlewareHandler } from 'hono'

type TraceContext = {
  /** 例: `4980b4fc3402665a0408736cf9a971b6` */
  traceId: string
  /** 例: `4912161a6ee9b655` */
  spanId?: string
}

const storage = new AsyncLocalStorage<TraceContext>()

/** 現在のリクエストの trace context (ハンドラ・サービス層から参照) */
export function getTraceContext(): TraceContext | undefined {
  return storage.getStore()
}

/**
 * `x-cloud-trace-context` ヘッダ (`TRACE_ID/SPAN_ID;o=OPTIONS`) を解析して
 * AsyncLocalStorage に格納する Hono ミドルウェア。
 * これ以降のハンドラ・logger 呼び出しで `getTraceContext()` から取れる。
 */
export const traceContextMiddleware: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('x-cloud-trace-context')
  if (!header) {
    await next()
    return
  }
  const [tracePart] = header.split(';')
  if (!tracePart) {
    await next()
    return
  }
  const [traceId, spanId] = tracePart.split('/')
  if (!traceId) {
    await next()
    return
  }
  await storage.run(spanId ? { traceId, spanId } : { traceId }, () => next())
}

/**
 * Cloud Logging が認識する trace / spanId フィールド名を生成する。
 * `GOOGLE_CLOUD_PROJECT` が設定されていれば fully-qualified resource name で
 * 出力するため Console の "Trace" タブで関連ログが正しく紐付く。
 */
export function buildTraceFields(): Record<string, string> | undefined {
  const ctx = getTraceContext()
  if (!ctx) return undefined
  const project = process.env['GOOGLE_CLOUD_PROJECT']
  const trace = project ? `projects/${project}/traces/${ctx.traceId}` : ctx.traceId
  const fields: Record<string, string> = {
    'logging.googleapis.com/trace': trace,
  }
  if (ctx.spanId) {
    fields['logging.googleapis.com/spanId'] = ctx.spanId
  }
  return fields
}
