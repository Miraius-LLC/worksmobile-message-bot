## ADDED Requirements

### Requirement: Imageとvideoの添付指定は排他である

image/videoのschemaはfileId単独またはpreviewImageUrlとoriginalContentUrlの組だけを受理しなければならない（SHALL）。

#### Scenario: File IDのみを指定する
- **WHEN** fileIdのみを指定する
- **THEN** image/videoの検証に成功する

#### Scenario: URLの組を指定する
- **WHEN** fileIdなしで両URLを指定する
- **THEN** image/videoの検証に成功する

#### Scenario: File IDとURLを混在させる
- **WHEN** fileIdと片方または両方のURLを指定する
- **THEN** image/videoの検証に失敗する

### Requirement: LINE WORKSのtimeout errorはURLの機微要素を残さない

共通fetchのFetchTimeoutErrorはmessageとurlからuserinfo、query、fragmentを除去しなければならない（SHALL）。parse不能なURLは[invalid-url]に置き換えなければならない（SHALL）。timeoutMsと本文timeout、cancel、caller signalの契約は維持しなければならない（SHALL）。

#### Scenario: 機微要素付きURLがtimeoutする
- **WHEN** userinfo、query、fragment付きURLがtimeoutする
- **THEN** errorのmessage/urlにはscheme、host、pathのみが残る

#### Scenario: 不正なURLからerrorを作る
- **WHEN** parse不能なURLでFetchTimeoutErrorを構築する
- **THEN** errorのmessage/urlには固定文字列[invalid-url]を用いる
