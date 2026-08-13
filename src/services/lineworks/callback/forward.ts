import { fetchWithTimeout } from '@/services/lineworks/_fetch'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/callback/forward'

/**
 * 受信したCallback（raw body + 署名）を設定済みupstreamへ転送する。
 * raw bodyを変更せず、X-WORKS-Signatureヘッダも引き継ぐ。
 *
 * レスポンス方針:
 *  - upstream が 2xx → 正常 (return)
 *  - upstream が 5xx / network error → throw (callback.ts が dedup を unregister → 500 返却。
 *    LINE WORKS 公式仕様として自動再送は行われないため、ログ記録および手動再投入用)
 *  - upstream が 4xx → 再送しても解決しないため warn して return (LINE WORKS へは 200 返却)
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
    logger.error('upstreamへのcallback転送が5xx（転送失敗）', {
      caller: `${CALLER}.forwardEventToUpstream`,
      status: response.status,
      debug: body,
    })
    throw new Error(`forward to upstream failed: ${response.status}`)
  }

  if (response.status >= 400) {
    const body = await response.text().catch(() => '')
    logger.warn('upstreamへのcallback転送が4xx（再試行対象外）', {
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
