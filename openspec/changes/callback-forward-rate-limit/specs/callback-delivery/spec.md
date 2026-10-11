## ADDED Requirements

### Requirement: Upstreamの流量制限を転送失敗として扱う

upstreamが429を返したとき、callback endpointは転送失敗として扱い、500を返してdedup keyを解除しなければならない（SHALL）。429は待てば通る一時障害であり、callbackが届いていないのに成功応答を返してはならない（MUST NOT）。

#### Scenario: Upstreamが429を返す

- **WHEN** 検証済みcallbackの転送先が429を返す
- **THEN** 転送関数は失敗をthrowし、endpointは500を返してdedup keyを解除し、同じcallbackの手動再投入を受け入れる

#### Scenario: Upstreamが再送で解決しない4xxを返す

- **WHEN** 転送先が401 / 403 / 429以外の4xxを返す
- **THEN** endpointは警告ログだけを残して成功応答を返す
