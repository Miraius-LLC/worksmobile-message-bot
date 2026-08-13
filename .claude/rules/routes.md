# ルート (HTTP エンドポイント) の規約

`src/routes/` 配下に Hono の `Hono` インスタンスをサブルータとして定義し、`src/index.ts` の root Hono に `app.route(prefix, subApp)` で mount する。

## エンドポイント追加の最小形

```ts
// src/routes/foo.ts
import { Hono } from 'hono'

export const fooApp = new Hono()

fooApp.get('/bar', c => c.json({ ok: true }))
```

`src/index.ts` で:
```ts
import { fooApp } from '@/routes/foo'
app.route('/foo', fooApp)
```

## メッセージ系エンドポイント (`/channels/:id/messages/type/<type>` / `/users/:id/messages/type/<type>`)

- 個別ファイルは追加しない。`src/services/lineworks/messages/index.ts` の `messageSenders` マップに登録すれば、`routes/messages.ts` のループが両 base × 全 type を自動で `messagesApp.post(...)` する
- type 名 (`text`, `button_template`, `flex` 等) は **README 記載の URL の type 部分そのまま**。スネークケースを保つ (LINE WORKS の URL 仕様に合わせる)
- `messagesApp` は `src/index.ts` で `app.route('/', messagesApp)` で mount している (prefix なし)

## 添付ファイル系 (`/attachments`)

- `routes/attachments/index.ts` の `attachmentsApp` に `POST /` (upload) と `GET /:fileId` (download) を登録済
- `src/index.ts` で `app.route('/attachments', attachmentsApp)` で mount
- multipart は **Hono の `c.req.parseBody()`** を使う。返り値の `body['file']` が `File` インスタンスかチェックしてから扱う (`instanceof File`)。`@fastify/multipart` や multer には戻さない
- 添付ファイル専用の `notFound` ハンドラを `attachmentsApp.notFound(...)` で設定済

## レスポンス規約

- 成功時:
  - メッセージ送信系: `201` + 空 body (`c.body(null, 201)`)。公式 LINE WORKS API 仕様に合わせる
  - 作成系 (トークルーム作成・固定メニュー登録・リッチメニュー作成・デフォルト適用など): `201` + JSON
  - アップロード (`/attachments`): `200` + `{ fileId }` (`c.json(...)`)
  - リッチメニュー画像登録: `204 No Content`
  - ダウンロード: `new Response(stream, { headers })` で fetch のレスポンス body をそのまま流す。`Content-Type` / `Content-Disposition` を引き継ぐ
- 失敗時: `c.json({ error: '...' }, <code>)`。error メッセージは可能なら原因まで含める
- ヘッダ転送時の注意 (download): `transfer-encoding`, `connection`, `keep-alive`, `content-encoding` は **転送しない** (上流が再計算するため二重化する)

## エラー処理

- 予期しない例外や `LineWorksApiError` は route ハンドラ内でむやみに try/catch して手動で 500 を返さず throw し、グローバルエラーハンドラ (`app.onError`) に拾わせて統一レスポンスを返す
- バリデーションエラー (400) など明示的な期待エラーのみハンドラ内で返却する

## HTTP/2

- コンテナは **HTTP/1.1 のみで listen** する。end-to-end h2c は採用しない (`node:http2` 単独サーバは Cloud Run Envoy が投げる素の HTTP/1.1 を受けられず protocol error になるため)
- 公開側の HTTP/2 は Cloud Run フロントエンドが終端する。`gcloud run deploy` に `--use-http2` は**つけない**
- HTTP/2 専用 API (server push 等) は使わない。Web 標準 Request/Response の範囲で書けば OK
