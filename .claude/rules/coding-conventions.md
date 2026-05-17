# コーディング規約 (Develop 共通)

ベース: [TypeScript命名規則コーディング規約 (Qiita)](https://qiita.com/mistylady/items/21843c01f0b7289a6c83)。
**ファイル名 / ディレクトリ名のケースは kebab-case** (グローバル `~/.claude/rules/source-file-naming.md` の規約に準拠)。

それ以外 (変数 / 関数 / 型 / 定数 / クラス / Interface 等の case) は Qiita 記事のルールに従う。

## 関連ドキュメント

- `commit.md` — コミットメッセージ規約 (gitmoji + 日本語)
- `worktree.md` — git worktree 運用ルール
- `git-log.md` — セッション開始時の git log 確認
- `tests.md` — テスト規約 (bun:test)
- プロジェクト固有の命名規則 (例: 501 の `naming.md`) は各プロジェクト側に配置

## 適用範囲

- **新規コード・新規ファイル**: 本規約に厳密に従う
- **既存コード**: 触る時 (周辺と一貫しないとき) のみ修正。規約導入だけのために一括リネームしない

## ケース規約 (要点)

| 対象 | ケース | 例 |
|---|---|---|
| 変数 / 関数 / メソッド / プロパティ | lowerCamelCase | `createFirstRunNotifier`, `userName` |
| 型 / Interface / Class / 関数コンポーネント | UpperCamelCase | `FirstRunNotifierOpts`, `JobInfo` |
| モジュール定数 (マジックナンバー) | UPPER_SNAKE_CASE | `CALLER`, `MAX_RETRY` |
| **関数内ローカル定数** (再代入なし) | **lowerCamelCase** | `fixedValue`, `maxAttempts` |
| env 変数 | UPPER_SNAKE_CASE | `NODE_ENV`, `LOG_LEVEL` |
| **ファイル名** | **kebab-case** | `first-run-notifier.ts`, `notify-failure.ts` |
| **ディレクトリ名** | **kebab-case** または 単語 1 個小文字 | `contact-note/`, `utils/`, `data/` |

### モジュール定数 vs ローカル定数 (Qiita 規約の重要ポイント)

| 種類 | スコープ | ケース | 例 |
|---|---|---|---|
| **マジックナンバー (グローバル定数)** | モジュールトップレベル | **UPPER_SNAKE_CASE** | `const CALLER = 'utils/foo'` |
| **ローカル定数** (再代入なしの一時値) | 関数内 | **lowerCamelCase** | `const subscriptionKeywords = [...]` |

> Qiita 記事: 「メソッド内などでローカル変数として定義し再代入を行わない変数として使う定数の命名には『ローワーキャメルケース』を利用する」

biome の `useNamingConvention` は const に対し `camelCase | PascalCase | CONSTANT_CASE` を許容 (top-level / block-scoped を区別する modifier が無いため)。**ローカル定数を UPPER_SNAKE_CASE で書くと biome 上はパスするが、本規約違反**。コードレビュー / 自己確認で守る。

## TS 識別子の追加ルール (Qiita 記事補足)

Qiita 記事に明記がない部分は TypeScript 公式 ([TypeScript Coding Guidelines](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines)) を参照:

- **Interface に `I` プレフィックスを付けない** (`IUser` ❌ → `User` ✅)
- **boolean 変数は `is*` / `has*` / `should*` を接頭辞**: `isDevelopment`, `hasCache`, `shouldRetry`
- **非同期処理を返す関数で曖昧にならない場合は `Async` サフィックス不要** (型で判別できるため)
- **略語**: 2 文字以下は全部大文字 / 3 文字以上は先頭大文字 + 残り小文字。揺れは周辺に合わせる (`parseHtmlString` も `parseHTMLString` も OK)

## ファイル名・ディレクトリ名

- **kebab-case** で統一 (グローバル `~/.claude/rules/source-file-naming.md` 準拠)
- URL / シェル補完で扱いやすい
- OS / FS の case sensitivity 差異の影響を受けない
- ヘルパファイル (登録対象外、内部利用のみ) は **先頭 `_` + kebab-case**: `_pickup-place.ts`, `_drive-notify.ts`

## import パスと alias

- `import` パスは **`@/` で `src/` を参照**、拡張子 `.ts` は付けない
  ```ts
  import { sendMessageByType } from '@/services/lineworks/messages'
  ```

## Linter / Formatter

- **Biome 単体** を使う (prettier / eslint なし)
- スタイル整形は手で書き直さず Biome に任せる: `bunx biome check --write ./src`
- pre-commit hook で auto-fix される (手動で先回り実行する必要は無い)
- `biome.jsonc` の `useNamingConvention` で識別子ケース、`useFilenamingConvention` でファイル名ケースを強制
- 外部 API の snake_case (CSV / 外部 SDK 等) を `typeProperty` / `objectLiteralProperty` で許容する設定を入れる

## ログと CALLER パターン

- ログは `@/utils/logger` に統合 (logger インスタンスを各ファイルで個別生成しない)
- 各ファイル冒頭で `const CALLER = '...'` を宣言 (パスは `src/` 配下の相対パス、例: `services/lineworks/auth`)
- メソッド単位で `${CALLER}.<method>` を logger オプションに渡す:
  ```ts
  logger.success('ファイルをアップロード', { caller: `${CALLER}.uploadAttachment`, id: fileId })
  ```
- 手書きで `caller: 'services/foo.bar'` と全文を書かない
- `console.log` / `console.error` は使わない (Biome の `noConsole` で警告)

## EditorConfig

- インデント: スペース 2
- 行末: LF
- 末尾改行: 必須 (Markdown のみ trim 例外)
- max line length: 100

## pre-commit / pre-push

`lefthook.yml` で:
- **pre-commit**: biome auto-fix → `tsc --noEmit` → 関連テスト (staged から逆引き)
- **pre-push**: 全件テスト (`bun test`)

手動で先回り実行する必要は無い。落ちたら原因を直してから commit / push。

## 「揺れ」が既存にある時

- 周辺のファイル / 既存コードに合わせる方を優先 (本ルールより周辺一貫性が上)
- 既存ディレクトリの多数派が PascalCase なら、新規追加もそれに合わせる
- 全体を揃え直したい場合は別ブランチで一括リネーム + import 更新 (片手間で混ぜない)
