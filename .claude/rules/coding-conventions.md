---
paths:
  - "**/*.{ts,tsx}"
---

# コーディング規約（Develop 共通）

新規コードの基準です。既存コードは変更箇所の周辺に合わせます。repo-local の `AGENTS.md` / `CLAUDE.md` や設定が具体的なら、そのrepoの指示を優先します。

- TS の命名は Biome の設定に従う。boolean は `is*` / `has*` / `should*` で始める。
- TypeScript の import は、設定されている場合は `@/` alias（`src/` を指す）を使い、近接moduleは相対pathにします。source importに `.ts` 拡張子は付けず、runtime/compilerが明示拡張子を要求するrepoではその設定に従います。絶対的な端末pathは書きません。
- アプリのログはrepoの共有loggerへ集約します。`@/utils/logger` を使うTypeScript appではmoduleごとに `CALLER` を定義し、`caller` には `CALLER` とmethod名を連結した値を渡します。`console.log` / `console.error` はログに使いません。CLIの利用者向け出力はstdout/stderrへ出します。
- app設定の環境変数は起動境界でschema検証し、必須値の不正は起動時に止めます。TypeScript appでは既存のZod schemaを使い、未検証値を型castで通しません。
- BunのI/O APIを使うmoduleでは `import Bun from 'bun'` を明示します。整形・lintはrepoに設定されたformatterとlefthookに従います。
