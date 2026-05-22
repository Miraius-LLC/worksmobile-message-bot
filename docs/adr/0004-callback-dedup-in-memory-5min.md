# callback dedup は in-memory Map・5 分 window

LINE WORKS の callback 再送による副作用二重実行を防ぐため、`callback/dedup.ts` で **raw body の SHA-256** を key にした in-memory Map で **直近 5 分 window** の重複を検出し、ヒットしたら skip して 200 を返す。callback payload には event ID 相当のフィールドが無いため payload 全体のハッシュを key にする。**Cloud Run の min-instances=1 前提**（複数 instance になると instance ごとに別 Map になり dedup が破綻する。`cloudbuild.yaml` で `--min-instances=1` を明示）。501 への転送（[ADR-0005](./0005-forward-callback-to-501.md)）が throw した場合は dedup key を `unregister` して LINE WORKS の再送を許可する（転送失敗 event の喪失防止）。

## 検討した代替
- **Redis 等の共有ストア**: 現規模（1 instance 張り付き）では過剰。max-instances を増やして 2 instance 目が立つ頻度が上がったら共有ストアへ移行する前提。

_出典: CLAUDE.md 注意点（よくあるハマり）/ README.md Callback（受信側）, commit 4254e35 / 4784cca_
