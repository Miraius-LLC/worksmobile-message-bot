## MODIFIED Requirements

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
