import type { MiddlewareHandler } from 'hono'
import { logger } from '@/utils/logger'

const CALLER = 'utils/request-log'

/**
 * 全リクエストを `logger.request` で 1 行ずつ記録する Hono ミドルウェア。
 * `method` / `url` (path) / `status` / `duration` を構造化フィールドで出すので、
 * Cloud Logging で「`status>=400` だけ」「`duration>1000` だけ」等の絞り込みができる。
 *
 * `traceContextMiddleware` の後ろに挿す前提で、`buildTraceFields()` が
 * trace / spanId を自動付与する (logger 側で参照される)。
 */
export const requestLogMiddleware: MiddlewareHandler = async (c, next) => {
  const startTime = performance.now()
  try {
    await next()
  } finally {
    const duration = Math.round(performance.now() - startTime)
    logger.request('リクエスト完了', {
      caller: `${CALLER}.middleware`,
      method: c.req.method,
      url: c.req.path,
      status: c.res.status,
      duration,
    })
  }
}
