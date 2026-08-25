## ADDED Requirements

### Requirement: Callbackを検証してから処理する

callback endpointはraw bodyの署名、`X-WORKS-BotId`、JSON shapeを検証した後にだけdedupとupstream転送を進めなければならない（SHALL）。

#### Scenario: Bot ID headerが欠落する

- **WHEN** callback requestに`X-WORKS-BotId`がない
- **THEN** endpointは400を返しupstreamへ転送しない

#### Scenario: Bot IDが一致しない

- **WHEN** callback requestのBot IDが設定値と一致しない
- **THEN** endpointは403を返しupstreamへ転送しない

### Requirement: Callbackを5分間best-effortでdeduplicateする

callbackはraw bodyのSHA-256 digestをkeyとするin-memory Mapで5分間deduplicateしなければならない（SHALL）。この保証をWorkers isolate間またはCloud Run instance間へ拡張してはならない（MUST NOT）。

#### Scenario: 同一instanceで重複callbackを受け取る

- **WHEN** 同じraw bodyのcallbackを5分以内に再度受信する
- **THEN** endpointは重複として処理し、upstreamへ再転送しない

#### Scenario: Dedup windowを過ぎる

- **WHEN** 同じraw bodyを最後の登録から5分経過後に受信する
- **THEN** endpointは新しいcallbackとして処理できる

### Requirement: 設定可能なupstreamへ同期転送する

`FORWARD_CALLBACK_URL`が設定されている場合、callback endpointは検証済みraw bodyと`X-WORKS-Signature`をそのupstreamへ同期的に転送し、完了を待ってから応答しなければならない（SHALL）。

#### Scenario: Upstream転送に成功する

- **WHEN** 検証済みcallbackのupstreamが成功応答を返す
- **THEN** endpointは転送完了後に成功応答を返す

#### Scenario: Upstream URLが未設定である

- **WHEN** `FORWARD_CALLBACK_URL`が設定されていない
- **THEN** endpointは転送せず成功応答を返す

#### Scenario: Upstream転送に失敗する

- **WHEN** upstream requestが失敗するか非成功応答を返す
- **THEN** endpointは500を返してdedup keyを解除し、同じcallbackの手動再投入を受け入れる

### Requirement: Callbackのbusiness logicをupstreamへ委譲する

転送対象callbackのbusiness logicはupstreamの責務とし、wmbot内の未接続dispatcherまたはhandlerを転送経路から呼び出してはならない（MUST NOT）。

#### Scenario: Callback eventを受信する

- **WHEN** eventが検証とdedupを通過する
- **THEN** wmbotはraw eventをupstreamへ届け、domain固有の応答処理を実行しない
