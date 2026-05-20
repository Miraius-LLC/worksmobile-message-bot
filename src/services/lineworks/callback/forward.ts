import { fetchWithTimeout } from '@/services/lineworks/_fetch'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/callback/forward'

/**
 * 受信した Callback (raw body + 署名) を 501 (scheduler-501) の /callback に転送する。
 *
 * 501 が業務 handler (/today /status 等) を持つため、wmbot は LINE WORKS gateway として
 * 受けて素通しするだけ (= 案 B)。転送するもの:
 *  - raw body をそのまま (501 が SHA-256 dedup + 署名検証を再実行するため 1 byte も変えない)
 *  - X-WORKS-Signature ヘッダ (501 が同じ lineworks-bot-secret で再検証する)
 *
 * レスポンス方針 (LINE WORKS の再送判定に合わせる):
 *  - 501 が 2xx → 正常 (return)
 *  - 501 が 5xx / network error → throw (callback.ts が dedup を unregister → 500 →
 *    LINE WORKS が再送 → 再転送される)
 *  - 501 が 4xx → 再送しても直らない (bad payload / 署名不一致) ので warn して return
 *    (LINE WORKS には 200 を返させて再送ループを防ぐ)
 */
export async function forwardEventTo501(
  rawBody: string,
  signature: string | undefined,
): Promise<void> {
  const url = config().forward501CallbackUrl
  if (!url) {
    logger.warn('FORWARD_501_CALLBACK_URL 未設定のため callback 転送を skip', {
      caller: `${CALLER}.forwardEventTo501`,
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
    logger.error('501 への callback 転送が 5xx (再送対象)', {
      caller: `${CALLER}.forwardEventTo501`,
      status: response.status,
      debug: body,
    })
    throw new Error(`forward to 501 failed: ${response.status}`)
  }

  if (response.status >= 400) {
    const body = await response.text().catch(() => '')
    logger.warn('501 への callback 転送が 4xx (再送しない)', {
      caller: `${CALLER}.forwardEventTo501`,
      status: response.status,
      debug: body,
    })
    return
  }

  logger.info('callback を 501 に転送', {
    caller: `${CALLER}.forwardEventTo501`,
    status: response.status,
  })
}
