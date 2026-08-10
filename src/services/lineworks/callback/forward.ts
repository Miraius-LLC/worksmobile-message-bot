import { fetchWithTimeout } from '@/services/lineworks/_fetch'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/callback/forward'

/**
 * 受信したCallback（raw body + 署名）を設定済みupstreamへ転送する。
 * raw bodyを変更せず、X-WORKS-Signatureヘッダも引き継ぐ。
 *
 * レスポンス方針 (LINE WORKS の再送判定に合わせる):
 *  - upstream が 2xx → 正常 (return)
 *  - upstream が 5xx / network error → throw (callback.ts が dedup を unregister → 500 →
 *    LINE WORKS が再送 → 再転送される)
 *  - upstream が 4xx → 再送しても直らないためwarnしてreturn
 *    (LINE WORKS には 200 を返させて再送ループを防ぐ)
 */
export async function forwardEventToUpstream(
  rawBody: string,
  signature: string | undefined,
): Promise<void> {
  const url = config().forwardCallbackUrl
  if (!url) {
    logger.warn('FORWARD_CALLBACK_URL 未設定のためcallback転送をskip', {
      caller: `${CALLER}.forwardEventToUpstream`,
    })
    return
  }

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'X-WORKS-Signature': signature } : {}),
    },
    body: rawBody,
  })

  if (response.status >= 500) {
    const body = await response.text().catch(() => '')
    logger.error('upstreamへのcallback転送が5xx（再送対象）', {
      caller: `${CALLER}.forwardEventToUpstream`,
      status: response.status,
      debug: body,
    })
    throw new Error(`forward to upstream failed: ${response.status}`)
  }

  if (response.status >= 400) {
    const body = await response.text().catch(() => '')
    logger.warn('upstreamへのcallback転送が4xx（再送しない）', {
      caller: `${CALLER}.forwardEventToUpstream`,
      status: response.status,
      debug: body,
    })
    return
  }

  logger.info('callbackをupstreamへ転送', {
    caller: `${CALLER}.forwardEventToUpstream`,
    status: response.status,
  })
}
