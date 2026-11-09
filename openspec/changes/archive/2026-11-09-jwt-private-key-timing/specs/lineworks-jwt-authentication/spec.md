## MODIFIED Requirements

### Requirement: Base64 encoded PEMだけを秘密鍵入力として受け付ける

`PRIVATE_KEY`はBase64 encoded PEMとして受け取り、config読込時にPEMへdecodeして検証しなければならない（SHALL）。

#### Scenario: 有効な秘密鍵を読み込む

- **WHEN** `PRIVATE_KEY`がBase64 encoded PEMを含む
- **THEN** config validationが成功し、decodeしたPEMをJWT署名に使用する

#### Scenario: 生PEMまたは不正な値を受け取る

- **WHEN** `PRIVATE_KEY`が期待するBase64 encoded PEMではない
- **THEN** Cloud Runでは起動時、Workersでは初回request時のconfig読込でvalidationに失敗する
