## Why

callback転送は、upstreamの5xx・認証拒否（401 / 403）・3xxだけを転送失敗として扱い、残りの4xxは「再送しても解決しない」として警告ログで済ませ、LINE WORKSへ200を返す。429（流量制限）は待てば通る一時障害で、この前提に当たらない。upstreamが429を返すと、callbackは届かないまま200が返り、dedup keyも残るため、手動再投入も5分間は重複として弾かれる。

## What Changes

- upstreamの429を転送失敗として扱い、callback endpointが500を返してdedup keyを解除し、手動再投入を受け入れる
- 429以外の4xxは従来どおり再試行対象外として扱う

## Capabilities

### Modified Capabilities

- `callback-delivery`: upstreamの429を転送失敗に加える

## Impact

- `src/services/lineworks/callback/forward.ts`
- `src/services/lineworks/callback/forward.test.ts`
- `tests/routes/callback.test.ts`
- 観測可能な変化: upstreamが429を返したとき、callback endpointは200ではなく500を返し、dedup keyを残さない
- 対象外: 挙動不変のrefactor、依存関係だけの更新、typo修正
