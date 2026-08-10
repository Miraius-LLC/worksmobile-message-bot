import { Hono } from 'hono'
import { buildDedupKey, checkAndRegister, unregister } from '@/services/lineworks/callback/dedup'
import { forwardEventToUpstream } from '@/services/lineworks/callback/forward'
import { callbackEventSchema } from '@/services/lineworks/callback/schemas'
import { verifyCallbackSignature } from '@/services/lineworks/callback/verify'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'routes/callback'

/**
 * LINE WORKS Bot Callbackの受信エンドポイント。任意のupstream転送にも対応する。
 *
 * 流れ:
 * 1. raw body を `c.req.text()` で取得 (`c.req.json()` を先に呼ぶと再取得できない)
 * 2. `X-WORKS-Signature` を HMAC-SHA256 (with BOT_SECRET) で検証 → NG なら 401
 * 3. raw body の SHA-256 を dedup key として直近 5 分以内の再送を検出 → 副作用無しで 200
 * 4. raw body を JSON.parse → Zod の `discriminatedUnion` で 8 event type を検証 → NG なら 400
 * 5. 転送先が設定されていればraw bodyと署名をそのまま転送する。5xx / network error時は
 *    dedup key を unregister して LINE WORKS の再送を許可する
 * 6. 正常時は 200 (LINE WORKS は再送しないため body は不要)
 *
 * BASIC 認証は `app.ts` の PUBLIC_PATHS で除外済。署名検証で真正性を担保する。
 * ローカルhandler（dispatch.ts / handlers/）は転送経路では呼ばれない。
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

  const dedupKey = buildDedupKey(rawBody)
  if (checkAndRegister(dedupKey)) {
    logger.info('Callback は 5 分以内の重複なので skip (副作用無しで 200)', {
      caller: `${CALLER}.post`,
      debug: { dedupKey: dedupKey.slice(0, 16) },
    })
    return c.body(null, 200)
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

  try {
    await forwardEventToUpstream(rawBody, signature)
  } catch (error) {
    // 転送先が5xx / network errorで落ちた場合はdedup keyを取り消し、LINE WORKSの
    // 再送が再転送されるようにする。throw は `app.onError` に流して 500 + { error } で返す
    unregister(dedupKey)
    throw error
  }
  return c.body(null, 200)
})
