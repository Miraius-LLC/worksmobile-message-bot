/**
 * `process.env[key]` は `noUncheckedIndexedAccess` で `string | undefined` になる。
 * setup.ts でフィクスチャ env を埋めた前提のテストで毎回 `?? ''` するのは煩雑なので、
 * 不在なら即 throw して `string` を返すヘルパに集約する。
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`expected env ${key} to be set by test-helpers/setup.ts`)
  }
  return value
}
