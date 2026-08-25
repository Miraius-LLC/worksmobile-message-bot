## ADDED Requirements

### Requirement: Public path以外へBASIC認証を要求する

applicationは全pathに対するmiddlewareでBASIC認証を適用し、明示したpublic pathだけを除外しなければならない（SHALL）。BASIC auth middlewareは有効な設定を確認してからlazyに初期化する。

Source ADR: [ADR-0006](../../../../../docs/adr/0006-basic-auth-except-health-and-callback.md)

#### Scenario: 保護対象endpointへ認証なしでaccessする

- **WHEN** clientがpublic path以外へ有効なBASIC credentialsなしでrequestする
- **THEN** applicationは認証エラーを返しroute handlerを実行しない

#### Scenario: 保護対象endpointへ有効な認証でaccessする

- **WHEN** clientがpublic path以外へ有効なBASIC credentialsでrequestする
- **THEN** applicationはrequestをroute handlerへ渡す

### Requirement: Root、health probe、callbackをBASIC認証から除外する

`/`、canonical health pathの`/healthz`、互換aliasの`/health`・`/readyz`・`/livez`、および`/callback`はBASIC認証を要求してはならない（MUST NOT）。callbackの認証はLINE WORKS署名検証へ委ねる。

#### Scenario: Health probeへaccessする

- **WHEN** infrastructureがいずれかのhealth pathへcredentialsなしでrequestする
- **THEN** applicationは共通health handlerの応答を返す

#### Scenario: Callbackへaccessする

- **WHEN** LINE WORKSが`/callback`へBASIC credentialsなしでrequestする
- **THEN** applicationはBASIC認証で拒否せず、callback署名検証を実行する

### Requirement: HTTPExceptionのstatusを保持する

global error handlerはBASIC auth等のHono middlewareが投げる`HTTPException`を`getResponse()`で返し、本来のstatusを500へ変換してはならない（MUST NOT）。

#### Scenario: BASIC認証が失敗する

- **WHEN** BASIC auth middlewareが`HTTPException`を投げる
- **THEN** clientはmiddlewareが指定した認証statusとresponseを受け取る
