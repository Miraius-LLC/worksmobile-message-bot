/**
 * `fetch` のタイムアウト統一ラッパ。
 *
 * 全 LINE WORKS 系 service の `fetch` を本関数経由にすることで、
 * upstream の hang (応答返さず無言切断もせず) によって Cloud Run の instance slot
 * (concurrency=80) が枯渇する事故を予防する。
 *
 * 実装: `AbortController` + `setTimeout` で指定 ms 経過後に abort。
 * abort された fetch は `AbortError` を throw するので、`FetchTimeoutError` に変換して
 * 呼び出し側で識別しやすくする。
 *
 * 標準 fetch との違い:
 *  - `timeoutMs` オプション (デフォルト `DEFAULT_TIMEOUT_MS`)
 *  - 既存の `signal` を渡している場合は両方を合成する (`AbortSignal.any`)
 */

const DEFAULT_TIMEOUT_MS = 15_000

/** upload など長時間 fetch の用途で使う既定値 (1 MB 以下 × 数回の往復に余裕がある) */
export const LONG_TIMEOUT_MS = 60_000

export class FetchTimeoutError extends Error {
  readonly url: string
  readonly timeoutMs: number

  constructor(url: string, timeoutMs: number) {
    super(`LINE WORKS API への fetch がタイムアウトしました (timeoutMs=${timeoutMs}, url=${url})`)
    this.name = 'FetchTimeoutError'
    this.url = url
    this.timeoutMs = timeoutMs
  }
}

export type FetchWithTimeoutInit = RequestInit & { timeoutMs?: number }

/**
 * タイムアウト付き fetch。デフォルト 15 秒。
 *
 * 既存の `signal` を `init` に渡している場合は、両方の abort 条件のいずれかが
 * 先に発火した時点で fetch が abort される (`AbortSignal.any` で合成)
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...rest } = init

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const signal = callerSignal
    ? AbortSignal.any([callerSignal, controller.signal])
    : controller.signal

  try {
    return await fetch(url, { ...rest, signal })
  } catch (error: unknown) {
    // タイマー発火経由の AbortError だけ FetchTimeoutError に変換する。
    // 呼び出し側 (callerSignal) 経由の abort はそのまま伝播
    if (controller.signal.aborted && isAbortError(error)) {
      throw new FetchTimeoutError(String(url), timeoutMs)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
}
