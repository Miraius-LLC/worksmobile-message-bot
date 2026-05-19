import { getServerToken } from '@/services/lineworks/auth'
import type { CallbackEvent } from '@/services/lineworks/callback/schemas'
import {
  type MessageBody,
  type MessageType,
  sendMessageByType,
} from '@/services/lineworks/messages'
import type { MessageTarget } from '@/types/lineworks'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/callback/reply'

/**
 * Callback event の `source` から `MessageTarget` を組み立てる。
 *
 * 仕様:
 * - `channelId` があれば常にトークルーム宛で返信する (1:1 でも 1:N でも channelId が
 *   ある場合 = postback / begin / end / 複数人 message。LINE WORKS は channelId が
 *   ある時はトークルームに送るのが自然)
 * - `channelId` が無い場合 (= 1:1 トークで送られた message event) は userId 宛て
 * - 上記いずれにも該当しない (= join / leave / joined / left は userId が無い) ケースでは
 *   channelId で返信
 */
export function targetFromSource(source: CallbackEvent['source']): MessageTarget {
  if ('channelId' in source && typeof source.channelId === 'string') {
    return { channelId: source.channelId }
  }
  if ('userId' in source && typeof source.userId === 'string') {
    return { userId: source.userId }
  }
  throw new Error(`reply 先を組み立てられない source です: ${JSON.stringify(source)}`)
}

/**
 * Callback event に対する返信を 1 行で書くためのヘルパ。
 *
 * 流れ: source → MessageTarget 変換 → アクセストークン取得 → `sendMessageByType` 呼び出し。
 * トークンは `getServerToken()` 内でキャッシュ + single-flight 済なので、同一リクエスト内で
 * 何度呼んでも実 fetch は 1 回。
 */
export async function reply<T extends MessageType>(
  source: CallbackEvent['source'],
  type: T,
  body: MessageBody<T>,
): Promise<void> {
  const target = targetFromSource(source)
  const token = await getServerToken()
  await sendMessageByType(config().botId, token, target, type, body)
  logger.success('Callback への返信を送信', {
    caller: `${CALLER}.reply`,
    debug: { type, target },
  })
}
