# Why

READMEのimage/video排他契約と実装を一致させ、timeout error経由のURL資格情報漏洩を防ぐ。

# What Changes

- image/videoでfileIdとURLの混在を拒む。
- FetchTimeoutErrorのmessage/urlからuserinfo、query、fragmentを除去する。

# Impact

変更はmessage schemaと共通fetch error、対応テストに限定する。READMEの現行契約を維持する。挙動不変refactor・依存更新・typo修正は今回の対象外。
