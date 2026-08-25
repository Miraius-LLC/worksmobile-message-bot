import type { Context } from 'hono'

type ValidationResult =
  | { success: true }
  | {
      success: false
      error: { issues: Array<{ message: string }> }
    }

/** 一覧 query の検証失敗を共通の 400 JSON に変換する。 */
export function queryValidationHook(result: ValidationResult, c: Context): Response | undefined {
  if (result.success) return undefined

  const message = result.error.issues[0]?.message ?? 'クエリパラメータが不正です'
  return c.json({ error: message }, 400)
}
