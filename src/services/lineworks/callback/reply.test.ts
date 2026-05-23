import { describe, expect, mock, test } from 'bun:test'

// reply ヘルパは内部で getServerToken / sendMessageByType を呼ぶので、
// mock.module で差し替えてから動的 import する (tests-lineworks.md の典型パターン)
//
// mock.module はファイル跨ぎでグローバルに効くため、共有モジュール
// (@/services/lineworks/messages) を差し替える際は実 export を spread で維持し、
// spy したい sendMessageByType だけ上書きする。messageSchemas / messageTypes を
// 空に潰すと、それを import する別ファイル (messages/index.test.ts) にリークして
// 「ローカル緑・CI 赤」を引き起こす (lessons L7)。

import * as realMessages from '@/services/lineworks/messages'

const sendMessageByTypeMock = mock(async () => {})
const getServerTokenMock = mock(async () => 'fixed-test-token')

mock.module('@/services/lineworks/messages', () => ({
  ...realMessages, // messageSchemas / messageTypes など実 export を維持
  sendMessageByType: sendMessageByTypeMock,
}))
mock.module('@/services/lineworks/auth', () => ({
  getServerToken: getServerTokenMock,
}))

const { reply, targetFromSource } = await import('@/services/lineworks/callback/reply')

describe('targetFromSource', () => {
  test('channelId + userId 両方ある (postback / begin / end) → channelId 優先', () => {
    const t = targetFromSource({
      userId: 'u1',
      channelId: 'c1',
      domainId: 1,
    })
    expect(t).toEqual({ channelId: 'c1' })
  })

  test('channelId のみ (join / leave / joined / left) → channelId', () => {
    const t = targetFromSource({ channelId: 'c1', domainId: 1 })
    expect(t).toEqual({ channelId: 'c1' })
  })

  test('userId のみ (message in 1:1 トーク、channelId なし) → userId', () => {
    const t = targetFromSource({ userId: 'u1', domainId: 1 })
    expect(t).toEqual({ userId: 'u1' })
  })

  test('userId + channelId 両方 (1:N message) → channelId 優先', () => {
    const t = targetFromSource({ userId: 'u1', channelId: 'c1', domainId: 1 })
    expect(t).toEqual({ channelId: 'c1' })
  })

  test('userId も channelId も無い → throw', () => {
    expect(() => targetFromSource({ domainId: 1 } as never)).toThrow('reply 先を組み立てられない')
  })
})

describe('reply', () => {
  test('source + type + body を渡すと sendMessageByType が呼ばれる', async () => {
    sendMessageByTypeMock.mockClear()
    getServerTokenMock.mockClear()

    await reply({ userId: 'u1', channelId: 'c1', domainId: 1 }, 'text', { text: 'hi' } as never)

    expect(getServerTokenMock).toHaveBeenCalledTimes(1)
    expect(sendMessageByTypeMock).toHaveBeenCalledTimes(1)
    const call = sendMessageByTypeMock.mock.calls[0] as unknown as [
      string,
      string,
      { channelId: string } | { userId: string },
      string,
      { text: string },
    ]
    // botId / token / target / type / body の順
    expect(typeof call[0]).toBe('string') // botId
    expect(call[1]).toBe('fixed-test-token')
    expect(call[2]).toEqual({ channelId: 'c1' })
    expect(call[3]).toBe('text')
    expect(call[4]).toEqual({ text: 'hi' })
  })

  test('1:1 message (channelId なし) は userId 宛て', async () => {
    sendMessageByTypeMock.mockClear()
    await reply({ userId: 'u1', domainId: 1 }, 'text', { text: 'yo' } as never)
    const call = sendMessageByTypeMock.mock.calls[0] as unknown as [
      string,
      string,
      { channelId: string } | { userId: string },
      string,
      { text: string },
    ]
    expect(call[2]).toEqual({ userId: 'u1' })
  })

  test('sendMessageByType が throw すると reply も throw する (上位の onError に流す)', async () => {
    sendMessageByTypeMock.mockClear()
    sendMessageByTypeMock.mockImplementationOnce(async () => {
      throw new Error('upstream 500')
    })
    await expect(
      reply({ channelId: 'c1', domainId: 1 }, 'text', { text: 'x' } as never),
    ).rejects.toThrow('upstream 500')
  })
})
