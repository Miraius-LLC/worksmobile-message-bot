# message-type-dispatch Specification

## Purpose

メッセージ型のschema registry、汎用dispatcher、channels / users route生成contractを固定する。

## Requirements

### Requirement: Message typeとvalidation schemaを単一mapで管理する

対応するmessage typeは`messageSchemas` mapをregistryとして管理し、typeごとの個別sender functionを作ってはならない（MUST NOT）。

Source ADR: [ADR-0007](../../../docs/adr/0007-message-type-dispatcher.md)

#### Scenario: Message typeを追加する

- **WHEN** LINE WORKSの新しいmessage typeへ対応する
- **THEN** Agentはschemaをregistryへ追加し、必要な場合だけpayload transformを定義する

### Requirement: Generic dispatcherがwire payloadを構築する

`sendMessageByType`はtarget、type、validated bodyを受け取り、LINE WORKSへ送るpayloadを`{ type, ...body }`として構築しなければならない（SHALL）。

#### Scenario: Validated messageを送る

- **WHEN** routeがtypeとvalidated bodyをdispatcherへ渡す
- **THEN** dispatcherはtarget URLを解決し、type discriminatorを含むpayloadを1回送信する

### Requirement: Channelsとusersのrouteをregistryから生成する

message routesは`channels`と`users`の両target baseについて、registryに存在する全message typeをloopで登録しなければならない（SHALL）。

#### Scenario: Registryへtypeを追加する

- **WHEN** `messageSchemas`へ新しいtypeを追加する
- **THEN** channels用とusers用の対応routeが個別route定義なしで利用可能になる
