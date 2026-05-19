import type { CallbackEvent } from '@/services/lineworks/callback/schemas'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/callback/handlers/postback'

/**
 * `postback` event のハンドラ (雛形)。
 *
 * postback は button_template / carousel / image_carousel / quickReply 等で送ったボタンが
 * 押された時に発火する。`data` には送信時に埋めた任意の string が入ってくるので、
 * 「`action=approve`」「`reservation_id=abc&action=cancel`」のような独自プロトコルを
 * 設計して分岐させる。
 *
 * 現状は雛形 (ログのみ) で、具体的な action 分岐は実 use case が出たときに追加する。
 * 想定する追加パターン:
 *   - `data` を URLSearchParams で parse → action 別 sub-handler を呼ぶ
 *   - 押下確認用に reply() で「承りました」を返す等
 */
export async function handlePostback(
  event: Extract<CallbackEvent, { type: 'postback' }>,
): Promise<void> {
  logger.info('postback event を受信 (現状はログのみ、応答は未実装)', {
    caller: `${CALLER}.handlePostback`,
    debug: { data: event.data, source: event.source },
  })
}
