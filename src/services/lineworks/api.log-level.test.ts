import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// `src/test-helpers/setup.ts` の no-op logger を spy 化して上書きする。
// 静的 import 前に呼ばないと SUT (`@/services/lineworks/api`) が
// 古い mock を捕まえてしまうため、SUT は `await import(...)` で取り込む。
type LoggerCall = (message: unknown, option?: { caller?: string; status?: number }) => void
const loggerSpies = {
  failure: mock<LoggerCall>(() => {}),
  error: mock<LoggerCall>(() => {}),
  warn: mock<LoggerCall>(() => {}),
  info: mock<LoggerCall>(() => {}),
  success: mock<LoggerCall>(() => {}),
  request: mock<LoggerCall>(() => {}),
  debug: mock<LoggerCall>(() => {}),
}
mock.module('@/utils/logger', () => ({
  logger: loggerSpies,
  withDuration: async <T>(action: () => Promise<T>) => action(),
}))

const { postJson, LineWorksApiError } = await import('@/services/lineworks/api')

let originalFetch: typeof globalThis.fetch
beforeEach(() => {
  originalFetch = globalThis.fetch
  for (const spy of Object.values(loggerSpies)) spy.mockClear()
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

function installFetch(status: number, body: string) {
  globalThis.fetch = mock(async () => new Response(body, { status })) as unknown as typeof fetch
}

describe('postJson のログレベル切り分け', () => {
  test('5xx は logger.error で出る', async () => {
    installFetch(500, 'internal error')
    await expect(postJson('tok', 'https://x.test/y', {})).rejects.toBeInstanceOf(LineWorksApiError)

    expect(loggerSpies.error).toHaveBeenCalledTimes(1)
    expect(loggerSpies.warn).not.toHaveBeenCalled()
    const opt = loggerSpies.error.mock.calls[0]?.[1]
    expect(opt?.caller).toBe('services/lineworks/api.postJson')
    expect(opt?.status).toBe(500)
  })

  test('4xx (ACCESS_DENIED 以外) は logger.warn + 通常 caller', async () => {
    installFetch(400, JSON.stringify({ code: 'INVALID_PARAMETER', description: 'bad' }))
    await expect(postJson('tok', 'https://x.test/y', {})).rejects.toBeInstanceOf(LineWorksApiError)

    expect(loggerSpies.error).not.toHaveBeenCalled()
    expect(loggerSpies.warn).toHaveBeenCalledTimes(1)
    const opt = loggerSpies.warn.mock.calls[0]?.[1]
    expect(opt?.caller).toBe('services/lineworks/api.postJson')
    expect(opt?.status).toBe(400)
  })

  test('ACCESS_DENIED は専用 caller (postJson.botKicked) で warn', async () => {
    installFetch(
      403,
      JSON.stringify({ code: 'ACCESS_DENIED', description: 'Access is denied for the room.' }),
    )
    await expect(postJson('tok', 'https://x.test/y', {})).rejects.toBeInstanceOf(LineWorksApiError)

    expect(loggerSpies.error).not.toHaveBeenCalled()
    expect(loggerSpies.warn).toHaveBeenCalledTimes(1)
    const opt = loggerSpies.warn.mock.calls[0]?.[1]
    expect(opt?.caller).toBe('services/lineworks/api.postJson.botKicked')
    expect(opt?.status).toBe(403)
  })
})
