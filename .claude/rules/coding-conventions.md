# コーディング規約（Develop 共通）— 常駐入口

新規コードの命名・import・ログ・整形は `~/Develop/AGENTS.md` §3 を適用する。既存コードでは周辺一貫性を優先する。識別子ケース、例、Biome / EditorConfig / lefthook の詳細は `~/Develop/docs/develop-coding.md` を、ファイル名は全島共通の `~/.agents/rules/source-file-naming.md` を参照する。

- **関数内の一時 `const` は `lowerCamelCase`**。Biome は top-level 定数と区別できず、`UPPER_SNAKE_CASE` でも通るので自己確認する。
- interface に `I` を付けない。boolean は `is*` / `has*` / `should*` を使う。
