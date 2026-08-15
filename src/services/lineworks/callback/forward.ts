import { fetchWithTimeout } from '@/services/lineworks/_fetch'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/callback/forward'

/**
 * 受信したCallback（raw body + 署名）を設定済みupstreamへ転送する。
 * raw bodyを変更せず、X-WORKS-Signatureヘッダも引き継ぐ。
 *
 * upstream が Cloudflare Access の内側にいる場合は service token ヘッダを付ける。
 *
 * レスポンス方針:
 *  - upstream が 2xx → 正常 (return)
 *  - upstream が 5xx / network error → throw (callback.ts が dedup を unregister → 500 返却。
 *    公式ページでは再送契約を確認できないため、ログ記録および手動再投入時の再実行用)
 *  - upstream が **401 / 403** → throw。⚠️ これは「upstream の入口で弾かれた」= **こちらの設定事故**で、
 *    黙って 200 を返すと **callback が消える**。Access の token 誤り・失効を必ず表に出す
 *  - 上記以外の 4xx → 再送しても解決しないため warn して return (LINE WORKS へは 200 返却)
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

  const { cfAccessClientId, cfAccessClientSecret } = config()
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'X-WORKS-Signature': signature } : {}),
      ...(cfAccessClientId && cfAccessClientSecret
        ? {
            'CF-Access-Client-Id': cfAccessClientId,
            'CF-Access-Client-Secret': cfAccessClientSecret,
          }
        : {}),
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

  // 401 / 403 は upstream の入口 (Cloudflare Access 等) で弾かれた合図。
  // 4xx としてやり過ごすと callback が黙って消えるので、5xx と同じく throw して表に出す。
  if (response.status === 401 || response.status === 403) {
    const body = await response.text().catch(() => '')
    logger.error('upstreamへのcallback転送が認証エラー（設定事故の疑い）', {
      caller: `${CALLER}.forwardEventToUpstream`,
      status: response.status,
      debug: body,
    })
    throw new Error(`forward to upstream rejected: ${response.status}`)
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
