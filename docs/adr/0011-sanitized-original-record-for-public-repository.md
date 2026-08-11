---
status: accepted
date: 2026-08-11
---

# ADR-0011: 公開repositoryでは環境固有情報をSanitized Original Recordへ置換する

## Context and Problem Statement

本リポジトリは公開repositoryであり、既存ADRの原文には環境固有のサービス構成、resource識別子、URLなど、公開側へ戻してはならない情報が含まれる場合がある。一方、ADR-0013相当の移行監査により、移行済みADRの判断履歴と改変検出を維持する必要がある。

## Decision Drivers

- 公開repositoryへ環境固有情報やprivateな責任分界を復元しない
- 判断の骨格、redaction理由、原文との対応を監査可能にする
- Sanitized本文の意図しない改変を公開側の検査で検出する
- 例外を対象ADRに限定し、新しいADRの無制限な省略を防ぐ

## Considered Options

- 旧原文を公開repositoryへ戻して既存のOriginal Record契約を満たす
- ADRを監査対象外へ移してdigest検査を行わない
- private原文のdigestとpublic sanitized本文のdigestを併記し、対象ADRだけをSanitized Original Recordとして扱う

## Decision Outcome

Chosen option: 「private原文のdigestとpublic sanitized本文のdigestを併記し、対象ADRだけをSanitized Original Recordとして扱う」

ADR-0001、ADR-0004、ADR-0005は、環境固有情報を除いた判断の骨格を`## Sanitized Original Record`へ保存する。各記録には次の二層digestを置く。

- `Private legacy source SHA-256`: private infra SoTに保管する原文との対応を示すprovenance。公開側では値だけを保持し、原文や復元可能な情報は保持しない。
- `Public sanitized record SHA-256`: 公開側のSanitized本文（フェンス内本文、末尾改行を除くUTF-8）に対するdigest。validatorが本文から再計算し、公開記録の意図しない改変を検出する。

対象番号はdevelop-metaのproject policyで明示し、`adrMigratedThrough`を下げて監査対象から除外しない。Sanitized archiveの形式、fence、二層digest、対象番号の対応はproject横断validatorで検査する。

### Consequences

- Good: private情報を公開repositoryへ戻さず、公開側の判断履歴とredaction理由を維持できる
- Good: public digestの再計算により、Sanitized本文の意図しない改変を検出できる
- Bad: public側だけではprivate原文の内容とdigestの対応を再計算できず、provenance確認はprivate側監査に依存する
- Neutral: 原文を完全保存するADRとSanitized本文を使うADRが併存するため、対象番号と責任分界をREADMEに明記する

### Confirmation

対象3 ADRについてprivate digest、public digest、Sanitized本文、Markdown fenceの形式を検査し、public digestを本文から再計算して一致することを確認する。`check-project-integrity`とrepo-local ADR検査が対象外ADRをSanitized扱いせず、公開repositoryへ旧service名・URL・resource識別子を復元していないことをレビューする。
