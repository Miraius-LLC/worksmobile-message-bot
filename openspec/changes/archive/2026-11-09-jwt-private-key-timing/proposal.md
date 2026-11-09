# Why

現行のJWT秘密鍵仕様に、config読込時のdecodeと実行環境ごとの検証時点が正しく記録されていない。

# What Changes

2026-11-09 藤井の決定: decode 時点は実装を正とする。Workers の失敗時点は仕様の文言だけ直す。外部挙動は変えない。

- `lineworks-jwt-authentication`の秘密鍵入力要件と不正鍵Scenarioを現行実装に合わせる。
- ADR-0003のOriginal Recordを保持して現在の実装を注記し、service ruleとAGENTS.mdの説明を合わせる。

# Impact

文書だけを更新する。`src/`と外部挙動は変更しない。挙動不変refactor、依存関係だけの更新、他のtypo修正は対象外。
