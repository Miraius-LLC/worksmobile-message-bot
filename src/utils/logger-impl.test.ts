import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
// `@/utils/logger` は preload で no-op に差し替えられているため、impl を直接 import する
import { createLogger, shouldUsePretty, withDuration } from './logger-impl'
import { traceContextMiddleware } from './trace'

type LogEntry = Record<string, unknown>

function makeCapturingLogger() {
  const entries: LogEntry[] = []
  const logger = createLogger({
    destination: {
      write(line: string) {
        entries.push(JSON.parse(line) as LogEntry)
      },
    },
  })
  return { logger, entries }
}

describe('utils/logger-impl: severity マッピング', () => {
  test.each([
    ['failure', 'CRITICAL'],
    ['error', 'ERROR'],
    ['warn', 'WARNING'],
    ['info', 'INFO'],
    ['success', 'INFO'],
    ['request', 'INFO'],
    ['debug', 'DEBUG'],
  ] as const)('%s レベルの severity は %s', (level, expected) => {
    const { logger, entries } = makeCapturingLogger()
    logger[level]('msg', { caller: 'X' })
    expect(entries[0]?.['severity']).toBe(expected)
  })

  test('msg / level / caller が log entry に含まれる', () => {
    const { logger, entries } = makeCapturingLogger()
    logger.error('boom', { caller: 'mod.fn', url: 'https://x.test' })
    expect(entries[0]).toMatchObject({
      msg: 'boom',
      level: 'error',
      caller: 'mod.fn',
      url: 'https://x.test',
    })
  })
})

describe('utils/logger-impl: error serializer', () => {
  test('Error を渡すと name/message/stack が抽出される (空オブジェクトに潰れない)', () => {
    const { logger, entries } = makeCapturingLogger()
    const err = new Error('something broke')
    logger.error('failed', { caller: 'X', error: err })

    const errField = entries[0]?.['error'] as Record<string, unknown> | undefined
    expect(errField).toBeDefined()
    expect(errField?.['type']).toBe('Error')
    expect(errField?.['message']).toBe('something broke')
    expect(typeof errField?.['stack']).toBe('string')
  })

  test('プレーンオブジェクトはそのまま乗る', () => {
    const { logger, entries } = makeCapturingLogger()
    logger.error('failed', { caller: 'X', error: { code: 42 } })
    expect(entries[0]?.['error']).toEqual({ code: 42 })
  })
})

describe('utils/logger-impl: trace fields 注入', () => {
  test('AsyncLocalStorage に trace が乗っていれば log entry に紐付く', async () => {
    const { logger, entries } = makeCapturingLogger()
    const app = new Hono()
    app.use('*', traceContextMiddleware)
    app.get('/', c => {
      logger.info('hi', { caller: 'X' })
      return c.json({})
    })
    await app.request('/', { headers: { 'x-cloud-trace-context': 'trace-abc/span-1' } })
    expect(entries[0]?.['logging.googleapis.com/trace']).toBe('trace-abc')
    expect(entries[0]?.['logging.googleapis.com/spanId']).toBe('span-1')
  })

  test('trace context が無ければ trace fields は乗らない', () => {
    const { logger, entries } = makeCapturingLogger()
    logger.info('hi', { caller: 'X' })
    expect(entries[0]?.['logging.googleapis.com/trace']).toBeUndefined()
    expect(entries[0]?.['logging.googleapis.com/spanId']).toBeUndefined()
  })
})

describe('utils/logger-impl: shouldUsePretty', () => {
  test('LOG_PRETTY=1 + NODE_ENV=development → true', () => {
    expect(shouldUsePretty({ LOG_PRETTY: '1', NODE_ENV: 'development' })).toBe(true)
  })

  test('LOG_PRETTY=1 + NODE_ENV=production → false (本番ビルドに pino-pretty が無いため)', () => {
    expect(shouldUsePretty({ LOG_PRETTY: '1', NODE_ENV: 'production' })).toBe(false)
  })

  test('LOG_PRETTY 未設定 → false', () => {
    expect(shouldUsePretty({ NODE_ENV: 'development' })).toBe(false)
  })

  test('LOG_PRETTY=0 → false', () => {
    expect(shouldUsePretty({ LOG_PRETTY: '0', NODE_ENV: 'development' })).toBe(false)
  })
})

describe('utils/logger-impl: production レベルフィルタ', () => {
  let original: string | undefined
  beforeEach(() => {
    original = process.env['NODE_ENV']
  })
  afterEach(() => {
    if (original === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV')
    else process.env['NODE_ENV'] = original
  })

  test('NODE_ENV=production では error 以上のみ出る (warn / info / success / request / debug は drop)', () => {
    process.env['NODE_ENV'] = 'production'
    const { logger, entries } = makeCapturingLogger()
    logger.debug('d', { caller: 'X' })
    logger.info('i', { caller: 'X' })
    logger.success('s', { caller: 'X' })
    logger.request('r', { caller: 'X' })
    logger.warn('w', { caller: 'X' })
    logger.error('e', { caller: 'X' })
    logger.failure('f', { caller: 'X' })

    // production の pino level は 'error' (50)。以前は全部 info 経由で書かれていたため
    // failure 以外が落ちる回帰があった。動的レベル経由になったのでこの並びが正しい
    const levels = entries.map(e => e['level'])
    expect(levels).toEqual(['error', 'failure'])
  })

  test('NODE_ENV=development では debug まで全部出る', () => {
    process.env['NODE_ENV'] = 'development'
    const { logger, entries } = makeCapturingLogger()
    logger.debug('d', { caller: 'X' })
    logger.info('i', { caller: 'X' })
    logger.error('e', { caller: 'X' })
    expect(entries.map(e => e['level'])).toEqual(['debug', 'info', 'error'])
  })
})

describe('utils/logger-impl: withDuration', () => {
  test('成功時は duration を付けて log を呼ぶ', async () => {
    const calls: Array<{ message: string; option: Record<string, unknown> }> = []
    const result = await withDuration(
      async () => 'ok',
      (message, option) => {
        calls.push({ message, option })
      },
      'done',
      { caller: 'X' },
    )
    expect(result).toBe('ok')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.message).toBe('done')
    expect(calls[0]?.option['caller']).toBe('X')
    expect(typeof calls[0]?.option['duration']).toBe('number')
  })

  test('失敗時は { error, duration } の形で throw', async () => {
    let caught: unknown
    try {
      await withDuration(
        async () => {
          throw new Error('boom')
        },
        () => {},
        'op',
      )
    } catch (e) {
      caught = e
    }
    const wrapped = caught as {
      error: { name: string; message: string; stack: string }
      duration: number
    }
    expect(wrapped.error.name).toBe('Error')
    expect(wrapped.error.message).toBe('boom')
    expect(typeof wrapped.error.stack).toBe('string')
    expect(typeof wrapped.duration).toBe('number')
  })

  test('Error 以外を throw された時はそのまま乗せる', async () => {
    let caught: unknown
    try {
      await withDuration(
        async () => {
          throw 'string-error'
        },
        () => {},
        'op',
      )
    } catch (e) {
      caught = e
    }
    const wrapped = caught as { error: unknown }
    expect(wrapped.error).toBe('string-error')
  })
})
