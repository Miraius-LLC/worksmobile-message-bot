## MODIFIED Requirements

### Requirement: Callbackを5分間best-effortでdeduplicateする

callbackはraw bodyのSHA-256 digestをkeyとするin-memory Mapで5分間deduplicateしなければならない（SHALL）。この保証をWorkers isolate間またはCloud Run instance間へ拡張してはならない（MUST NOT）。JSON / Zod validationで400を返したcallbackのkeyはdedup windowに残してはならない（MUST NOT）。

#### Scenario: 同一instanceで重複callbackを受け取る

- **WHEN** 同じraw bodyのcallbackを5分以内に再度受信する
- **THEN** endpointは重複として処理し、upstreamへ再転送しない

#### Scenario: Dedup windowを過ぎる

- **WHEN** 同じraw bodyを最後の登録から5分経過後に受信する
- **THEN** endpointは新しいcallbackとして処理できる

#### Scenario: 不正payloadを再送する

- **WHEN** JSON parseまたはZod validationに失敗するraw bodyを5分以内に再度受信する
- **THEN** endpointは毎回400を返し、upstreamへ転送しない
