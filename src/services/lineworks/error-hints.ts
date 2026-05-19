/**
 * LINE WORKS API のエラーコード → 日本語ヒント文のマッピング。
 *
 * LINE WORKS のエラーレスポンスは `{ code, description, ... }` の形で返ってくる。
 * よくある「Bot ダッシュボードの設定漏れ」起因のエラーを早期に切り分けられるよう、
 * 既知の code に対して「考えられる原因」と「直し方」を日本語で添える。
 *
 * spec ドキュメントが断片的なので、ここで列挙する code は実運用で観測したもの +
 * 一般的な OAuth / REST API 用語に基づく推測。新しいパターンが本番で出たら追記する。
 */

const ERROR_HINTS = new Map<string, string>([
  [
    'ACCESS_DENIED',
    'Bot がチャンネルから退室しているか、Bot ポリシーで該当操作が許可されていない可能性があります。Developer Console > Bot > 該当 Bot > Botポリシー の「1:1 トーク」「複数人トーク」が ON か、Bot がチャンネルに参加しているか確認してください。',
  ],
  [
    'BOT_NOT_ALLOWED',
    '該当 Bot がこのドメインで使用許可されていません。Developer Console > Bot > 該当 Bot > Bot ポリシーでドメイン利用を許可してください。',
  ],
  [
    'BOT_NOT_FOUND',
    '指定された Bot ID が存在しないか、テナントから削除されています。BOT_ID env と Developer Console 上の Bot ID が一致しているか確認してください。',
  ],
  [
    'CALLBACK_NOT_ENABLED',
    'Bot 設定で Callback URL が有効化されていません。Developer Console > Bot > 該当 Bot > Callback URL を ON にしてください。',
  ],
  [
    'CALLBACK_URL_NOT_REGISTERED',
    'Bot 設定で Callback URL が登録されていません。Developer Console > Bot > 該当 Bot > Callback URL に本番 URL (https://line-works.api.miraius.co.jp/callback) を登録してください。',
  ],
  [
    'EVENT_NOT_ALLOWED',
    '対象 Callback Event が Bot 設定で許可されていません。Developer Console > Bot > 該当 Bot > 受信する Callback Event のトグルを ON にしてください。',
  ],
  [
    'UNAUTHORIZED',
    'アクセストークンが無効です。CLIENT_ID / CLIENT_SECRET / SERVICE_ACCOUNT / PRIVATE_KEY の設定値を確認してください (JWT 署名失敗の可能性)。',
  ],
  [
    'INVALID_TOKEN',
    'アクセストークンが無効か期限切れです。getServerToken のキャッシュをクリアして再試行するか、CLIENT_ID / CLIENT_SECRET / PRIVATE_KEY を確認してください。',
  ],
  [
    'INVALID_PARAMETER',
    'リクエストパラメータが LINE WORKS の仕様を満たしていません。エラー本文の詳細を確認してください (フィールド長 / 必須項目 / 形式)。',
  ],
  [
    'BAD_REQUEST',
    'リクエスト本文が不正です。Zod 検証を通過していても LINE WORKS 側で別検証に引っかかっている可能性があります。エラー本文の詳細を確認してください。',
  ],
  [
    'NOT_FOUND',
    '対象リソース (channel / user / bot / richmenu 等) が存在しません。ID を再確認してください。',
  ],
  [
    'RATE_LIMIT_EXCEEDED',
    'API 呼び出しのレート制限に達しました。数秒〜数分待ってからリトライしてください。',
  ],
  [
    'INTERNAL_SERVER_ERROR',
    'LINE WORKS 側のサーバーエラーです。少し待ってからリトライ。継続する場合は LINE WORKS のステータスページを確認してください。',
  ],
])

/**
 * upstream エラーコードから日本語の hint 文を取得する。
 * 未知の code は undefined を返すので、レスポンス JSON の hint フィールドは自然に省略される
 */
export function getErrorHint(code: string | undefined): string | undefined {
  if (!code) return undefined
  return ERROR_HINTS.get(code)
}

/**
 * 既知エラーコード一覧 (テスト / ドキュメント生成用)。
 * `getErrorHint(code)` が必ず hint を返す code の集合
 */
export function knownErrorCodes(): readonly string[] {
  return Array.from(ERROR_HINTS.keys())
}
