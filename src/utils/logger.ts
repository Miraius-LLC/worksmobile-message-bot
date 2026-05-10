import { createLogger, shouldUsePretty } from './logger-impl'

export type { LogLevel, LogOption } from './logger-impl'
export { withDuration } from './logger-impl'

/**
 * プロセス共通の logger インスタンス。
 *
 * 実装は `logger-impl.ts` に分離してある (テスト時は preload で `@/utils/logger` を
 * no-op に差し替えるため、impl を直接 import すると素の挙動を検証できる)。
 */
export const logger = createLogger({ pretty: shouldUsePretty() })
