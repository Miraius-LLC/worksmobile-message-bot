# callback-delivery Specification

## Purpose

LINE WORKS callbackの検証、best-effort dedup、設定可能なupstreamへの同期転送境界を固定する。

## Requirements

### Requirement: Callbackを検証してから処理する

callback endpointはraw bodyの署名と`X-WORKS-BotId`を検証し、dedupを確認した後にJSON / Zod validationとupstream転送を進めなければならない（SHALL）。

Source ADRs: [ADR-0004](../../../docs/adr/0004-callback-dedup-in-memory-5min.md)、[ADR-0005](../../../docs/adr/0005-forward-callback-to-upstream.md)

#### Scenario: Bot ID headerが欠落する

- **WHEN** callback requestに`X-WORKS-BotId`がない
- **THEN** endpointは400を返しupstreamへ転送しない

#### Scenario: Bot IDが一致しない

- **WHEN** callback requestのBot IDが設定値と一致しない
- **THEN** endpointは403を返しupstreamへ転送しない

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

### Requirement: 設定可能なupstreamへ同期転送する

`FORWARD_CALLBACK_URL`が設定されている場合、callback endpointは検証済みraw bodyと`X-WORKS-Signature`をupstreamへ同期的に転送し、完了を待ってから応答しなければならない（SHALL）。redirectを自動追従してはならず（MUST NOT）、408、429、3xxまたは`opaqueredirect`を転送失敗として扱わなければならない（SHALL）。

#### Scenario: Opaque redirectを受け取る

- **WHEN** manual redirect responseが`type: opaqueredirect`かつstatus 0で返る
- **THEN** 転送関数は失敗をthrowし、callback endpointは500を返してdedup keyを解除する

#### Scenario: Upstream転送に成功する

- **WHEN** 検証済みcallbackのupstreamが成功応答を返す
- **THEN** endpointは転送完了後に成功応答を返す

#### Scenario: Upstream URLが未設定である

- **WHEN** `FORWARD_CALLBACK_URL`が設定されていない
- **THEN** endpointは転送せず成功応答を返す

#### Scenario: Upstream転送に失敗する

- **WHEN** upstream requestがnetwork error、408、429、5xx、または認証拒否の401 / 403で失敗する
- **THEN** endpointは500を返してdedup keyを解除し、同じcallbackの手動再投入を受け入れる

#### Scenario: Upstreamが3xxを返す

- **WHEN** upstreamが通常の3xx responseを返す
- **THEN** 転送関数は失敗をthrowし、redirect先へ追従しない

#### Scenario: Upstreamが429を返す

- **WHEN** 検証済みcallbackのupstreamが429を返す
- **THEN** endpointは500を返してdedup keyを解除する
- **AND** 同じpayloadの再投入は再びupstreamへ転送され、再度429なら500、成功応答なら200を返す

#### Scenario: Upstreamが408を返す

- **WHEN** 検証済みcallbackのupstreamが408を返す
- **THEN** endpointは500を返してdedup keyを解除する
- **AND** 同じpayloadの再投入は再びupstreamへ転送され、再度408なら500、成功応答なら200を返す

#### Scenario: その他4xxの挙動を維持する

- **WHEN** upstreamが401 / 403 / 408 / 429以外の4xxを返す
- **THEN** 転送関数はwarnしてreturnし、endpointは200を返す

### Requirement: Callbackのbusiness logicをupstreamへ委譲する

転送対象callbackのbusiness logicはupstreamの責務とし、wmbot内の未接続dispatcherまたはhandlerを転送経路から呼び出してはならない（MUST NOT）。

#### Scenario: Callback eventを受信する

- **WHEN** eventが検証とdedupを通過する
- **THEN** wmbotはraw eventをupstreamへ届け、domain固有の応答処理を実行しない

### Requirement: Callback本文を署名検証前に制限する

callback endpointは署名検証前にrequest bodyを実測byte数で最大1MiB（1,048,576 byte）までに制限しなければならない（SHALL）。Content-Lengthの有無や申告値によらず実測しなければならない（SHALL）。上限を超えたら残りの本文を読み切らずstreamを中断し、413と`{ error: 'callback body too large' }`を返さなければならない（SHALL）。超過本文の署名検証、dedup登録、upstream転送を行ってはならない（MUST NOT）。この制限はWorkers / Cloud Runの共通routeで適用しなければならない（SHALL）。

#### Scenario: Content-Lengthのない本文が上限を超える

- **WHEN** Content-Lengthなしのstreamが1MiBを超え、残りのchunkがある
- **THEN** endpointは残りを読まずstreamを中断し、署名検証より前に413を返し、upstreamへ転送しない

#### Scenario: Content-Lengthの過少申告がある

- **WHEN** Content-Lengthは上限内でも実際のstreamが1MiBを超える
- **THEN** endpointは実測値により残りを読まず中断し、413を返す

#### Scenario: 上限ちょうどの正常callbackを受け取る

- **WHEN** 正常な署名とBot IDのUTF-8本文がちょうど1MiBである
- **THEN** endpointは既存の検証・dedup・転送を行い、raw bodyと署名を保って200を返す

#### Scenario: 文字数では上限内だがbyte数は上限を超える

- **WHEN** UTF-8の本文byte数が1MiBを超える
- **THEN** endpointは文字数によらず413を返し、upstreamへ転送しない
