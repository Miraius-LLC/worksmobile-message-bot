# BASIC 認証を `/` と health probe / callback 以外に強制

公開 webhook エンドポイントの保護に **BASIC 認証**（`hono/basic-auth`）を `app.use('*', ...)` で全体に掛け、`PUBLIC_PATHS` set で除外パスを管理する。除外は **`/` と health probe 系**（`/healthz` を正、`/health` / `/readyz` / `/livez` は互換エイリアスで同じハンドラを共有、`HEALTH_PATHS` 配列で集中管理）、および **`/callback`**（LINE WORKS は BASIC 認証ヘッダを喋らないため、代わりに `X-WORKS-Signature` の HMAC 検証で真正性を担保）。Cloud Run / k8s probe / Docker HEALTHCHECK が認証で落ちないようにする。`basicAuth` は config().load() タイミングを跨ぐため **lazy 初期化**。`app.onError` は `basicAuth` 等が投げる `HTTPException` を `getResponse()` で素通しし、500 で潰さない。

_出典: CLAUDE.md 注意点（よくあるハマり）/ README.md エンドポイント一覧の認証注記_
