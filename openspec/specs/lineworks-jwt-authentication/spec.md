# lineworks-jwt-authentication Specification

## Purpose

LINE WORKS server token取得に使うJWTの署名方式、audience、秘密鍵入力contractを固定する。

## Requirements

### Requirement: LINE WORKS server token用JWTをRS256で署名する

worksmobile-message-botは外部JWT libraryを使わず、`node:crypto`のRSA-SHA256署名でLINE WORKS server token用JWTを生成しなければならない（SHALL）。

Source ADR: [ADR-0003](../../../docs/adr/0003-jwt-node-crypto-rs256.md)

#### Scenario: JWTを生成する

- **WHEN** server token取得用assertionを作成する
- **THEN** headerとpayloadをbase64url encodingし、`createSign("RSA-SHA256")`によるRS256 signatureを付与する

### Requirement: JWT audienceをtoken endpointと一致させる

JWTの`aud` claimは`https://auth.worksmobile.com/oauth2/v2.0/token`に固定し、token requestの`AUTH_URL`と一致しなければならない（SHALL）。

#### Scenario: Token endpointへrequestする

- **WHEN** JWT assertionを使ってserver tokenを要求する
- **THEN** JWTの`aud`とrequest先URLが同一である

### Requirement: Base64 encoded PEMだけを秘密鍵入力として受け付ける

`PRIVATE_KEY`はBase64 encoded PEMとして受け取り、起動時validation後に署名直前でPEMへdecodeしなければならない（SHALL）。

#### Scenario: 有効な秘密鍵を読み込む

- **WHEN** `PRIVATE_KEY`がBase64 encoded PEMを含む
- **THEN** config validationが成功し、decodeしたPEMをJWT署名に使用する

#### Scenario: 生PEMまたは不正な値を受け取る

- **WHEN** `PRIVATE_KEY`が期待するBase64 encoded PEMではない
- **THEN** applicationは起動時validationでfail-fastする
