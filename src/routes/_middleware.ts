import type { MiddlewareHandler } from 'hono'
import { getServerToken } from '@/services/lineworks/auth'

/** リクエストハンドラから `c.var.token` で参照できる Hono 型変数 */
export type AuthenticatedEnv = {
  Variables: {
    token: string
  }
}

/**
 * LINE WORKS のアクセストークンを取得して `c.var.token` に注入するミドルウェア。
 * `getServerToken()` は in-memory キャッシュ + single-flight 済みなので
 * 各リクエスト毎に呼んでも実 fetch は最大 1 回に抑えられる。
 */
export const tokenMiddleware: MiddlewareHandler<AuthenticatedEnv> = async (c, next) => {
  c.set('token', await getServerToken())
  await next()
}
