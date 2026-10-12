## Why

公開の`POST /callback`は署名検証前に本文全体を読み、未認証の大きなrequestによるメモリ消費を制限できない。

## What Changes

- 署名検証前に本文の実測byte数を1MiBまでに制限する
- 超過時は残りのstreamを読まず413を返し、署名検証・dedup・転送へ進まない

## Capabilities

### Modified Capabilities

- `callback-delivery`: 公開callbackの本文サイズを実測して制限する

## Impact

- `src/routes/callback.ts`、`tests/routes/callback.test.ts`、README、CHANGELOG
- 観測可能な変化: 本文が1MiBを超えるcallbackは413となる
- 共通Hono appで制限するため、Workers / Cloud Runの両runtimeに適用する
