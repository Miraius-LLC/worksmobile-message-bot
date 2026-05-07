import pino from 'pino'
import { buildTraceFields } from './trace'

type LogLevel = 'failure' | 'error' | 'warn' | 'info' | 'success' | 'request' | 'debug'

type LogOption = {
  caller?: string
  url?: string
  status?: number
  method?: string
  id?: string
  error?: unknown
  duration?: number
  debug?: unknown
}

const LOG_LEVELS = {
  failure: 60,
  error: 50,
  warn: 40,
  info: 30,
  success: 29,
  request: 28,
  debug: 20,
} as const

const LOG_LEVEL_NAMES = {
  60: 'failure',
  50: 'error',
  40: 'warn',
  30: 'info',
  29: 'success',
  28: 'request',
  20: 'debug',
} as const

const prettyTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    customColors:
      'failure:red,error:red,warn:yellow,info:blue,success:green,request:cyan,debug:gray',
    messageFormat: '{timestamp} {msg}',
    customLevels: LOG_LEVELS,
    customLevelNames: LOG_LEVEL_NAMES,
    translateTime: 'SYS:standard',
    ignore: 'hostname,pid',
  },
}

/**
 * pino のレベル → Cloud Logging severity への mapping。
 * Console の severity フィルタが正しく機能するようにする。
 * @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
 */
const SEVERITY_MAP: Record<LogLevel, string> = {
  failure: 'CRITICAL',
  error: 'ERROR',
  warn: 'WARNING',
  info: 'INFO',
  success: 'INFO',
  request: 'INFO',
  debug: 'DEBUG',
}

function createLogger(opts: { pretty?: boolean } = {}) {
  const pinoLogger = pino({
    formatters: {
      level: (label: string) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    customLevels: LOG_LEVELS,
    level: process.env['NODE_ENV'] === 'production' ? 'error' : 'debug',
    // Error はプロパティが non-enumerable のため、デフォルトでは `error: {}` で潰れる。
    // stdSerializers.err で name / message / stack を抽出する
    serializers: {
      error: pino.stdSerializers.err,
    },
    ...(opts.pretty ? { transport: prettyTransport } : {}),
  })

  const log = (level: LogLevel, message: unknown, option?: LogOption): void => {
    pinoLogger[level === 'failure' ? 'fatal' : 'info']({
      ...option,
      // Cloud Trace のリクエストコンテキストがあれば trace / spanId を付与し、
      // Cloud Logging Console の Trace タブで関連ログが紐付くようにする
      ...buildTraceFields(),
      msg: message,
      level,
      // Cloud Logging が認識する標準フィールド (Console の severity フィルタを有効化)
      severity: SEVERITY_MAP[level],
    })
  }

  return {
    failure: (message: unknown, option?: LogOption) => log('failure', message, option),
    error: (message: unknown, option?: LogOption) => log('error', message, option),
    warn: (message: unknown, option?: LogOption) => log('warn', message, option),
    info: (message: unknown, option?: LogOption) => log('info', message, option),
    success: (message: unknown, option?: LogOption) => log('success', message, option),
    request: (message: unknown, option?: LogOption) => log('request', message, option),
    debug: (message: unknown, option?: LogOption) => log('debug', message, option),
  }
}

// pino-pretty は devDependency なので本番イメージには入っていない。
// production で LOG_PRETTY=1 が誤って入っても無視して JSON 出力に倒す。
const isPretty = process.env['LOG_PRETTY'] === '1' && process.env['NODE_ENV'] !== 'production'
const logger = createLogger({ pretty: isPretty })

async function withDuration<T>(
  action: () => Promise<T>,
  logFn: (message: string, option: LogOption) => void,
  message: string,
  option: LogOption = {},
): Promise<T> {
  const startTime = performance.now()
  try {
    const result = await action()
    const duration = Math.round(performance.now() - startTime)
    logFn(message, { ...option, duration })
    return result
  } catch (error) {
    const duration = Math.round(performance.now() - startTime)
    const serializedError =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error
    throw { error: serializedError, duration }
  }
}

export { type LogLevel, type LogOption, logger, withDuration }
