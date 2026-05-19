import { describe, expect, mock, test } from 'bun:test'
import type { CallbackEvent } from '@/services/lineworks/callback/schemas'

// handleMessage は内部で reply を呼ぶ。reply 自体は別ファイルで test 済なので
// ここでは reply を spy して「どの引数で呼ばれたか」だけ検証する。

const replyMock = mock(async () => {})
mock.module('@/services/lineworks/callback/reply', () => ({
  reply: replyMock,
  targetFromSource: () => ({ channelId: 'c1' }),
}))

const { handleMessage } = await import('@/services/lineworks/callback/handlers/message')

function buildMessageEvent(
  text: string,
  contentType: 'text' | 'image' = 'text',
): Extract<CallbackEvent, { type: 'message' }> {
  return {
    type: 'message',
    source: { userId: 'u1', channelId: 'c1', domainId: 1 },
    issuedTime: '2026-05-19T11:00:00Z',
    content: contentType === 'text' ? { type: 'text', text } : { type: 'image', fileId: 'f1' },
  }
}

describe('handleMessage: /help', () => {
  test('"/help" でヘルプ文を text type で返信する', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('/help'))
    expect(replyMock).toHaveBeenCalledTimes(1)
    const [, type, body] = replyMock.mock.calls[0] as unknown as [
      CallbackEvent['source'],
      string,
      { text: string },
    ]
    expect(type).toBe('text')
    expect(body.text).toContain('/help')
    expect(body.text).toContain('/echo')
  })

  test('前後の空白は trim して判定する ("  /help  " も hit)', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('  /help  '))
    expect(replyMock).toHaveBeenCalledTimes(1)
  })
})

describe('handleMessage: /echo', () => {
  test('"/echo hello" → "hello" を text で返信', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('/echo hello'))
    const [, type, body] = replyMock.mock.calls[0] as unknown as [unknown, string, { text: string }]
    expect(type).toBe('text')
    expect(body.text).toBe('hello')
  })

  test('"/echo こんにちは 🌸" マルチバイト + 絵文字でも素直に返す', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('/echo こんにちは 🌸'))
    const [, , body] = replyMock.mock.calls[0] as unknown as [unknown, string, { text: string }]
    expect(body.text).toBe('こんにちは 🌸')
  })

  test('改行を含む "/echo line1\\nline2" もそのまま返す', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('/echo line1\nline2'))
    const [, , body] = replyMock.mock.calls[0] as unknown as [unknown, string, { text: string }]
    expect(body.text).toBe('line1\nline2')
  })

  test('"/echo" 引数なしは match しない → 返信なし', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('/echo'))
    expect(replyMock).not.toHaveBeenCalled()
  })
})

describe('handleMessage: 非コマンド / 非テキスト', () => {
  test('コマンドプレフィックス無しのテキストは返信しない (Bot が不用意に喋らない設計)', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('こんにちは'))
    expect(replyMock).not.toHaveBeenCalled()
  })

  test('"/" だけのコマンド未満も返信しない', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('/'))
    expect(replyMock).not.toHaveBeenCalled()
  })

  test('未定義コマンド "/foo" も返信しない', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('/foo bar'))
    expect(replyMock).not.toHaveBeenCalled()
  })

  test('content.type === "image" (テキスト以外) は返信しない', async () => {
    replyMock.mockClear()
    await handleMessage(buildMessageEvent('', 'image'))
    expect(replyMock).not.toHaveBeenCalled()
  })
})
