import { describe, expect, mock, test } from 'bun:test'
import type { CallbackEvent } from '@/services/lineworks/callback/schemas'

const loggerInfoMock = mock(() => {})
mock.module('@/utils/logger', () => ({
  logger: {
    info: loggerInfoMock,
    warn: () => {},
    error: () => {},
    success: () => {},
    debug: () => {},
    failure: () => {},
    request: () => {},
  },
}))

const { handlePostback } = await import('@/services/lineworks/callback/handlers/postback')

function buildPostbackEvent(data: string): Extract<CallbackEvent, { type: 'postback' }> {
  return {
    type: 'postback',
    source: { userId: 'u1', channelId: 'c1', domainId: 1 },
    issuedTime: '2026-05-19T11:00:00Z',
    data,
  }
}

describe('handlePostback', () => {
  test('logger.info を 1 回呼ぶ (雛形なので副作用はそれだけ)', async () => {
    loggerInfoMock.mockClear()
    await handlePostback(buildPostbackEvent('action=approve'))
    expect(loggerInfoMock).toHaveBeenCalledTimes(1)
  })

  test('debug フィールドに data と source が含まれる', async () => {
    loggerInfoMock.mockClear()
    await handlePostback(buildPostbackEvent('action=cancel'))
    const call = loggerInfoMock.mock.calls[0] as unknown as [
      string,
      { debug: { data: string; source: unknown } },
    ]
    expect(call[1].debug.data).toBe('action=cancel')
    expect(call[1].debug.source).toEqual({ userId: 'u1', channelId: 'c1', domainId: 1 })
  })

  test('throw しない (例外を上に伝播させない)', async () => {
    loggerInfoMock.mockClear()
    await expect(handlePostback(buildPostbackEvent(''))).resolves.toBeUndefined()
  })
})
