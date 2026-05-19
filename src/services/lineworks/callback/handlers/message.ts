import { reply } from '@/services/lineworks/callback/reply'
import type { CallbackEvent } from '@/services/lineworks/callback/schemas'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/callback/handlers/message'

const HELP_TEXT = [
  '利用可能なコマンド:',
  '  /help — このヘルプを表示',
  '  /echo <text> — text をそのまま返す',
].join('\n')

/**
 * `message` event のハンドラ。
 *
 * 現状サポートするのは text コンテンツの 2 コマンドだけ (MVP):
 * - `/help` → ヘルプ文を返信
 * - `/echo <text>` → text をそのまま返信
 *
 * コマンドにマッチしないテキスト / 画像・スタンプ等の非テキストはログ出力のみで返信しない。
 * Bot が不用意に喋らないようにするため。新コマンドは本ファイルに追加する。
 */
export async function handleMessage(
  event: Extract<CallbackEvent, { type: 'message' }>,
): Promise<void> {
  const { content, source } = event

  // messageContentSchema は z.union で textContentSchema + ... + unknownContentSchema (looseObject)
  // を結合しているため `content.type === 'text'` だけでは text フィールドの型が string に narrow
  // されない (looseObject 経由でも type が 'text' を取れる)。実際の text 有無を明示的に判定する
  if (content.type !== 'text' || typeof content.text !== 'string') {
    logger.debug('text 以外の content は MVP 段階では返信しない', {
      caller: `${CALLER}.handleMessage`,
      debug: { contentType: content.type },
    })
    return
  }

  const text = content.text.trim()

  if (text === '/help') {
    await reply(source, 'text', { text: HELP_TEXT })
    return
  }

  const echoMatch = text.match(/^\/echo\s+([\s\S]+)$/)
  if (echoMatch?.[1]) {
    await reply(source, 'text', { text: echoMatch[1] })
    return
  }

  logger.debug('未対応のメッセージ (返信なし)', {
    caller: `${CALLER}.handleMessage`,
    debug: { text: text.slice(0, 100) },
  })
}
