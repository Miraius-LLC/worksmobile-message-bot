import { Hono } from 'hono'
import { buildDedupKey, checkAndRegister, unregister } from '@/services/lineworks/callback/dedup'
import { forwardEventToUpstream } from '@/services/lineworks/callback/forward'
import { callbackEventSchema } from '@/services/lineworks/callback/schemas'
import { verifyBotId, verifyCallbackSignature } from '@/services/lineworks/callback/verify'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'routes/callback'

// 公式の本文最大値は記載なし (2026-10-12確認):
// https://developers.worksmobile.com/jp/docs/bot-callback
// https://developers.worksmobile.com/jp/docs/bot-callback-message
// 添付はfileIdを含むJSON。1MiBはwmbot独自の防御上限であり、公式上限ではない。
const MAX_CALLBACK_BODY_BYTES = 1024 * 1024

async function readCallbackBody(request: Request): Promise<string | null> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      // Content-Lengthを信用せず常に実測し、超過chunkも残りの本文も保持しない。
      if (size > MAX_CALLBACK_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(decoder.decode(value, { stream: true }))
    }
    chunks.push(decoder.decode())
    return chunks.join('')
  } finally {
    reader.releaseLock()
  }
}

/**
 * LINE WORKS Bot Callbackの受信エンドポイント。任意のupstream転送にも対応する。
 *
 * 流れ:
 * 1. raw body をbyte数の実測で制限して取得 → 1MiB超過なら残りを読まず413
 * 2. `X-WORKS-Signature` を HMAC-SHA256 (with BOT_SECRET) で検証 → NG なら 401
 * 3. `X-WORKS-BotId` ヘッダを検証 → 欠落なら 400、`config().botId` 不一致なら 403
 * 4. raw body の SHA-256 を dedup key として直近 5 分以内の再送を検出 → 副作用無しで 200
 * 5. raw body を JSON.parse → Zod の `discriminatedUnion` で 8 event type を検証 → NG なら dedup key を unregister して 400
 * 6. 転送先が設定されていればraw bodyと署名をそのまま転送する。5xx / network error時は
 *    dedup key を unregister し、手動再投入等で再処理できるようにする (公式ページでは再送契約を確認できないため同期await、失敗は500とログ)
 * 7. 正常時は 200 (空 body 返却)
 *
 * BASIC 認証は `app.ts` の PUBLIC_PATHS で除外済。署名検証および Bot ID 検証で真正性を担保する。
 * 業務固有の応答処理は ADR-0005 に従い upstream の責務とする。
 */
export const callbackApp = new Hono()

callbackApp.post('/', async c => {
  const rawBody = await readCallbackBody(c.req.raw)
  if (rawBody === null) return c.json({ error: 'callback body too large' }, 413)
  const signature = c.req.header('x-works-signature')

  if (!verifyCallbackSignature(rawBody, signature, config().botSecret)) {
    logger.warn('Callback の署名検証に失敗', {
      caller: `${CALLER}.post`,
      debug: { hasSignature: Boolean(signature) },
    })
    return c.json({ error: 'invalid signature' }, 401)
  }

  const botIdHeader = c.req.header('x-works-botid')
  const botIdVerification = verifyBotId(botIdHeader, config().botId)
  if (botIdVerification === 'missing') {
    logger.warn('Callback の Bot ID ヘッダが欠落', {
      caller: `${CALLER}.post`,
      debug: { hasBotId: false },
    })
    return c.json({ error: 'missing bot id' }, 400)
  }
  if (botIdVerification === 'mismatch') {
    logger.warn('Callback の Bot ID が不一致', {
      caller: `${CALLER}.post`,
      debug: { hasBotId: true, botIdMismatch: true },
    })
    return c.json({ error: 'bot id mismatch' }, 403)
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
    // 不正payloadのkeyを残すと、5分以内の再送が検証されずに200で返ってしまう
    unregister(dedupKey)
    return c.json({ error: 'invalid json' }, 400)
  }

  const result = callbackEventSchema.safeParse(parsedJson)
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'callback event の検証に失敗'
    logger.warn('Callback の Zod 検証に失敗', {
      caller: `${CALLER}.post`,
      debug: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    })
    unregister(dedupKey)
    return c.json({ error: message }, 400)
  }

  try {
    await forwardEventToUpstream(rawBody, signature)
  } catch (error) {
    // 転送先が5xx / network errorで落ちた場合はdedup keyを取り消し、
    // 手動再投入時等に再処理できるようにする。throw は `app.onError` に流して 500 + { error } で返す
    unregister(dedupKey)
    throw error
  }
  return c.body(null, 200)
})
