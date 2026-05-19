import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * LINE WORKS Bot Callback の署名検証。
 *
 * LINE WORKS は Bot Secret を鍵とする HMAC-SHA256 で raw body の MAC を計算し、
 * Base64 エンコードした値を `X-WORKS-Signature` ヘッダに載せて送ってくる。
 * 検証側は同じ計算をして Base64 文字列同士を timing-safe に比較する。
 *
 * @see https://developers.worksmobile.com/jp/docs/bot-callback
 */
export function verifyCallbackSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  botSecret: string,
): boolean {
  if (!signatureHeader) return false

  const expected = createHmac('sha256', botSecret).update(rawBody, 'utf8').digest('base64')

  const expectedBuf = Buffer.from(expected, 'utf8')
  const actualBuf = Buffer.from(signatureHeader, 'utf8')
  if (expectedBuf.length !== actualBuf.length) return false

  return timingSafeEqual(expectedBuf, actualBuf)
}
