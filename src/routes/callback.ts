import { Hono } from 'hono'
import { dispatch } from '@/services/lineworks/callback/dispatch'
import { callbackEventSchema } from '@/services/lineworks/callback/schemas'
import { verifyCallbackSignature } from '@/services/lineworks/callback/verify'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'routes/callback'

/**
 * LINE WORKS Bot Callback の受信エンドポイント。
 *
 * 流れ:
 * 1. raw body を `c.req.text()` で取得 (`c.req.json()` を先に呼ぶと再取得できない)
 * 2. `X-WORKS-Signature` を HMAC-SHA256 (with BOT_SECRET) で検証 → NG なら 401
 * 3. raw body を JSON.parse → Zod の `discriminatedUnion` で 8 event type を検証 → NG なら 400
 * 4. dispatcher へ流す。例外は `app.onError` が 500 で拾う
 * 5. 正常時は 200 (LINE WORKS は再送しないため body は不要)
 *
 * BASIC 認証は `app.ts` の PUBLIC_PATHS で除外済。署名検証で真正性を担保する
 */
export const callbackApp = new Hono()

callbackApp.post('/', async c => {
  const rawBody = await c.req.text()
  const signature = c.req.header('x-works-signature')

  if (!verifyCallbackSignature(rawBody, signature, config().botSecret)) {
    logger.warn('Callback の署名検証に失敗', {
      caller: `${CALLER}.post`,
      debug: { hasSignature: Boolean(signature) },
    })
    return c.json({ error: 'invalid signature' }, 401)
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawBody)
  } catch {
    logger.warn('Callback の body が JSON として parse 不能', { caller: `${CALLER}.post` })
    return c.json({ error: 'invalid json' }, 400)
  }

  const result = callbackEventSchema.safeParse(parsedJson)
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'callback event の検証に失敗'
    logger.warn('Callback の Zod 検証に失敗', {
      caller: `${CALLER}.post`,
      debug: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    })
    return c.json({ error: message }, 400)
  }

  await dispatch(result.data)
  return c.body(null, 200)
})
