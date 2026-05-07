import { z } from 'zod'

/**
 * Zod のエラーメッセージを既存 API の日本語形式に近づけるためのカスタムマップ。
 * `index.ts` 起動時に 1 度だけ呼ぶ。明示的に `{ message: '...' }` を指定したフィールド
 * (cf. `_schemas.ts`) は引き続きそちらが優先される。
 */
export function installJapaneseErrorMap(): void {
  z.config({
    customError: issue => {
      const path = issue.path?.length ? `'${issue.path.join('.')}'` : 'パラメータ'
      switch (issue.code) {
        case 'invalid_type':
          return `${path} は ${issue.expected} を指定してください`
        case 'too_big':
          if (issue.origin === 'string') {
            return `${path} は ${issue.maximum} 文字以内で指定してください`
          }
          if (issue.origin === 'array') {
            return `${path} の項目数は最大 ${issue.maximum} までです`
          }
          return undefined
        case 'too_small':
          if (issue.origin === 'string') {
            return `${path} は必須で、空文字列にできません`
          }
          if (issue.origin === 'array') {
            return `${path} は ${issue.minimum} 件以上必要です`
          }
          return undefined
        case 'invalid_format':
          return `${path} の形式が不正です`
        default:
          return undefined
      }
    },
  })
}
