# コーディング規約 (Develop 共通) — 常駐 index

ベース: [TypeScript命名規則コーディング規約 (Qiita)](https://qiita.com/mistylady/items/21843c01f0b7289a6c83)。
ファイル名・ディレクトリ名のケースは `source-file-naming.md` が SoT (kebab-case)。

**根拠・コード例・Biome / EditorConfig / lefthook の詳細は `~/Develop/docs/develop-coding.md`。**

## 適用範囲

- **新規コード・新規ファイル**: 本規約に厳密に従う
- **既存コード**: 触る時 (周辺と一貫しないとき) のみ修正。規約導入だけのために一括リネームしない
- **周辺一貫性が本規約より上**。既存の多数派に合わせる。全体を揃え直すなら別ブランチで一括リネーム + import 更新

## ケース規約

| 対象 | ケース | 例 |
|---|---|---|
| 変数 / 関数 / メソッド / プロパティ | lowerCamelCase | `createFirstRunNotifier`, `userName` |
| 型 / Interface / Class / 関数コンポーネント | UpperCamelCase | `FirstRunNotifierOpts`, `JobInfo` |
| モジュール定数 (マジックナンバー) | UPPER_SNAKE_CASE | `CALLER`, `MAX_RETRY` |
| **関数内ローカル定数** (再代入なし) | **lowerCamelCase** | `fixedValue`, `maxAttempts` |
| env 変数 | UPPER_SNAKE_CASE | `NODE_ENV`, `LOG_LEVEL` |
| ファイル名 / ディレクトリ名 | kebab-case | `first-run-notifier.ts`, `contact-note/` |

## 毎回効く判断 hook

| # | 判断 hook |
|---|---|
| C1 | **ローカル定数を UPPER_SNAKE_CASE で書かない**。biome は top-level と区別できず素通しするので、機械では止まらない |
| C2 | Interface に `I` を付けない。boolean は `is*` / `has*` / `should*` |
| C3 | import は `@/` で `src/` を参照し、拡張子を付けない |
| C4 | ログは `@/utils/logger` + ファイル冒頭の `const CALLER`。`console.log` / `console.error` を使わない |
| C5 | 整形は Biome に任せる (`bunx biome check --write ./src`)。手でスタイルを直さない。prettier / eslint を混ぜない |
