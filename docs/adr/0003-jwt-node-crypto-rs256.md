# JWT は node:crypto で自前生成（RS256）

LINE WORKS OAuth 用の JWT は **`node:crypto` の `createSign('RSA-SHA256')` で自前生成**する（`jsonwebtoken` パッケージは撤去済）。`aud` は LINE WORKS の OAuth トークンエンドポイント（`https://auth.worksmobile.com/oauth2/v2.0/token`）に固定し、`auth.ts` の `AUTH_URL` 定数と一致させる。署名鍵 `PRIVATE_KEY` は **Base64 エンコード済 PEM** を前提に `getPrivateKey` でデコードして使う（生 PEM を直接渡すと署名失敗、config の Zod schema が起動時に PEM 含有チェック）。

## 検討した代替
- **jsonwebtoken パッケージ**: RS256 署名は `node:crypto` だけで足りるため、依存削減目的で撤去した。

_出典: CLAUDE.md 注意点（MUST）/ services.md auth_
