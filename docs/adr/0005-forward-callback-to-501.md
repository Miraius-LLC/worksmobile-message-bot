# callback を 501 に転送する（案 B）

本サーバは LINE WORKS の **gateway** として callback を受信し、署名検証 → dedup → Zod 検証を通したら、raw body + `X-WORKS-Signature` を env `FORWARD_501_CALLBACK_URL`（= scheduler-501 の `/callback`）へ **そのまま素通し転送**する（`callback/forward.ts`、未設定なら転送せず skip）。応答コマンド（`/today` `/status` 等）の handler は **501 側**にある。Google Calendar / scheduler 等のドメインが必要な処理を 501 に集約し、本サーバは LINE WORKS との接続・検証・転送だけに責務を絞るため。

本サーバ内の `callback/{dispatch,handlers,reply}.ts` のローカル handler 雛形は二重応答を避けるため**呼ばれない**（削除はせず雛形として残置）。応答コマンドの追加は 501 側で行う。

## 検討した代替
- **本サーバ内でローカル応答（雛形 handler を使う）**: 501 と二重応答になり、ドメインロジックが 2 リポに分散する。転送 1 本に統一した。

_出典: CLAUDE.md 注意点（よくあるハマり）/ README.md 応答コマンド, commit 88cdc90 / 2fee811_
