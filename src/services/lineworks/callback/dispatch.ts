import type { CallbackEvent } from '@/services/lineworks/callback/schemas'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/callback/dispatch'

/**
 * 受信した Callback event を type 別に分配する。
 *
 * Phase 1 (受信基盤) では「ログ出力 + 200 OK」のみ。
 * Phase 2 以降で各 type に handler を実装する際は、`switch` の各分岐で
 * `handlers/<type>.ts` から import した関数を呼ぶ形にする (シグネチャは
 * `(event: Extract<CallbackEvent, { type: 'X' }>) => Promise<void>`)。
 *
 * route 層 (`routes/callback.ts`) はこの関数を呼ぶだけで、内部のエラーは
 * そのまま throw される → `app.onError` が 500 で拾うので、各分岐で try/catch しない
 */
export async function dispatch(event: CallbackEvent): Promise<void> {
  logger.info('callback event を受信', {
    caller: `${CALLER}.dispatch`,
    debug: { type: event.type, source: event.source },
  })

  switch (event.type) {
    case 'message':
      // Phase 2-b: services/lineworks/callback/handlers/message.ts を呼ぶ
      break
    case 'postback':
      // Phase 2-c: services/lineworks/callback/handlers/postback.ts を呼ぶ
      break
    case 'join':
    case 'leave':
    case 'joined':
    case 'left':
    case 'begin':
    case 'end':
      // ライフサイクル系: 現段階では受信ログのみ。
      // 必要になったタイミングで handler を追加する (例: join 時に welcome メッセージを送る)
      break
  }
}
