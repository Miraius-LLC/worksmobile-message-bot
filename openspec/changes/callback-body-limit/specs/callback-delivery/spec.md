## ADDED Requirements

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
