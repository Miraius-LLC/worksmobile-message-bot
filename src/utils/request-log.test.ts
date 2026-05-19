import { beforeEach, describe, expect, mock, test } from 'bun:test'

// SUT (`@/utils/request-log`) より前に logger を spy 化する。
// setup.ts の no-op logger を上書きする形なので静的 import 不可、SUT は動的 import で取り込む。
type LoggerCall = (
  message: unknown,
  option?: { caller?: string; method?: string; url?: string; status?: number; duration?: number },
) => void
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

const { Hono } = await import('hono')
const { requestLogMiddleware } = await import('@/utils/request-log')

beforeEach(() => {
  for (const spy of Object.values(loggerSpies)) spy.mockClear()
})

describe('utils/request-log', () => {
  test('成功レスポンスで method / url / status / duration を logger.request に渡す', async () => {
    const app = new Hono()
    app.use('*', requestLogMiddleware)
    app.get('/hello', c => c.json({ ok: true }))

    const res = await app.request('/hello')
    expect(res.status).toBe(200)

    expect(loggerSpies.request).toHaveBeenCalledTimes(1)
    const opt = loggerSpies.request.mock.calls[0]?.[1]
    expect(opt?.caller).toBe('utils/request-log.middleware')
    expect(opt?.method).toBe('GET')
    expect(opt?.url).toBe('/hello')
    expect(opt?.status).toBe(200)
    expect(typeof opt?.duration).toBe('number')
    expect((opt?.duration ?? -1) >= 0).toBe(true)
  })

  test('POST + 4xx でも 1 行ログを出す (status / method がそのまま乗る)', async () => {
    const app = new Hono()
    app.use('*', requestLogMiddleware)
    app.post('/bad', c => c.json({ error: 'nope' }, 400))

    await app.request('/bad', { method: 'POST' })

    const opt = loggerSpies.request.mock.calls[0]?.[1]
    expect(opt?.method).toBe('POST')
    expect(opt?.status).toBe(400)
  })

  test('ハンドラが throw しても finally で 1 行ログを出す (status は onError 後の値)', async () => {
    const app = new Hono()
    app.use('*', requestLogMiddleware)
    app.get('/boom', () => {
      throw new Error('boom')
    })
    app.onError((_e, c) => c.json({ error: 'caught' }, 500))

    const res = await app.request('/boom')
    expect(res.status).toBe(500)

    expect(loggerSpies.request).toHaveBeenCalledTimes(1)
    const opt = loggerSpies.request.mock.calls[0]?.[1]
    expect(opt?.status).toBe(500)
    expect(opt?.method).toBe('GET')
    expect(opt?.url).toBe('/boom')
  })
})
