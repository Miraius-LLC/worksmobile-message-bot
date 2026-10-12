## MODIFIED Requirements

### Requirement: 設定可能なupstreamへ同期転送する

`FORWARD_CALLBACK_URL`が設定されている場合、callback endpointは検証済みraw bodyと`X-WORKS-Signature`をupstreamへ同期的に転送し、完了を待ってから応答しなければならない（SHALL）。redirectを自動追従してはならず（MUST NOT）、3xxまたは`opaqueredirect`を転送失敗として扱わなければならない（SHALL）。

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

- **WHEN** upstream requestがnetwork error、5xx、または認証拒否の401 / 403で失敗する
- **THEN** endpointは500を返してdedup keyを解除し、同じcallbackの手動再投入を受け入れる

#### Scenario: Upstreamが3xxを返す

- **WHEN** upstreamが通常の3xx responseを返す
- **THEN** 転送関数は失敗をthrowし、redirect先へ追従しない
