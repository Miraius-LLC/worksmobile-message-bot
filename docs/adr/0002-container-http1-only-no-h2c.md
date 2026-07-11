---
status: accepted
date: 2026-05-23
---

# ADR-0002: コンテナは HTTP/1.1 のみ、end-to-end h2c 不採用

## Context and Problem Statement

このADRは共通テンプレート導入前に作成された。移行前の判断記録は末尾の「Original Record」に内容を変更せず保存する。

## Decision Drivers

- 移行前の判断内容と履歴を変更しない
- 全ADRを共通のfitness functionで監査可能にする

## Considered Options

- 既存ADRをlegacyとして監査対象外のまま維持する
- 原文を現在形で要約し直す
- 原文を完全保存したまま標準構造を付加する

## Decision Outcome

Chosen option: 「原文を完全保存したまま標準構造を付加する」

移行前のADRに記録された判断を維持する。判断の詳細・理由・比較した選択肢は「Original Record」を正とする。

### Consequences

- Good: 移行前の記録を失わず、全ADRを同じ構造で検索・監査できる
- Bad: 移行済みADRには標準構造と移行前原文が併存する
- Neutral: この形式移行は既存の判断、status、相対リンクの意味を変更しない

### Confirmation

移行前原文のSHA-256を照合し、Git差分とproject横断ADR監査で欠落・改変がないことを確認する。

<!-- Legacy source SHA-256: e66ea9e2fb61d3a570dcf9c185f0d0efaf05a4eacbda883da193aabc2b0e0485 -->

## Original Record

~~~~markdown
# コンテナは HTTP/1.1 のみ、end-to-end h2c 不採用

コンテナは **HTTP/1.1 のみで listen** する。Bun / Node の `node:http2` 単独サーバは HTTP/1.1 を併行受信できず（`allowHTTP1` は ALPN / Upgrade 経由でしか効かない）、Cloud Run の Envoy は素の HTTP/1.1 をコンテナへ投げてくるため、h2c サーバだと protocol error になる。公開側の HTTP/2 は **Cloud Run フロントエンドが終端**し、フロント↔コンテナは HTTP/1.1 で渡る。デプロイに `--use-http2`（`--no-use-http2` を明示）は付けない。webhook サーバなので multiplexing の効果も限定的。

## 検討した代替
- **end-to-end h2c（コンテナまで HTTP/2）**: 上記の通り `node:http2` 単独サーバが Envoy の素の HTTP/1.1 を受けられず protocol error になるため不可。

_出典: CLAUDE.md 注意点（よくあるハマり）/ routes.md HTTP/2, README.md HTTP プロトコル_
~~~~
