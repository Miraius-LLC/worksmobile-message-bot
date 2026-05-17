# ソースコードファイル命名規則

ソースコード (TypeScript / JavaScript / Python / Ruby / Shell スクリプト 等) の **ファイル名・ディレクトリ名** の命名規約。
業務ファイル (PDF / Word / Excel 等) の命名は別ファイル `file-naming.md` を参照。

## 共通原則

| 対象 | ケース | 例 |
|---|---|---|
| **ファイル名** (`.ts` / `.js` / `.py` / `.rb` / `.sh` 等) | **kebab-case** | `first-run-notifier.ts`, `notify-failure.ts`, `gmail-attachments-dl.ts`, `miraius-audit.ts` |
| **ディレクトリ名** | **kebab-case** または 単語 1 個小文字 | `contact-note/`, `trans-schedule/`, `utils/`, `data/`, `scripts/` |
| **ヘルパファイル** (登録対象外、内部利用のみ) | 先頭 `_` + kebab-case | `_pickup-place.ts`, `_drive-notify.ts` |
| 日付プレフィックス | **付けない** | ❌ `2026-05-16_audit.ts` → ✅ `audit.ts` (案件 ID は git コミット日で追える) |

ファイル内の識別子 (変数・関数・型・クラス等) のケースは **言語規約に従う**:
- TypeScript / JavaScript: camelCase / PascalCase / UPPER_SNAKE (詳細は各プロジェクトのルール)
- Python: snake_case / PascalCase
- Ruby: snake_case / PascalCase

ファイル名と中の識別子 case が異なるのは許容: `first-run-notifier.ts` 内で `export function createFirstRunNotifier()` (ファイル kebab、関数 camel)。

## なぜ kebab-case か

- **CLI コマンド・URL・シェル補完で扱いやすい** (空白・大文字混在しないため)
- **OS / FS の case sensitivity 差異の影響を受けない** (macOS / Linux / Windows 移植時の事故が起きにくい)
- **ジョブ・スクリプト名がパスと一致** (例: `501 job data wam scrape disabled-child-consultation-supports` ↔ `src/jobs/data/wam/scrape/disabled-child-consultation-supports.ts`)

## 単語 1 個の場合

全小文字: `config.ts`, `date.ts`, `logger.ts`, `index.ts`

`Config.ts` (PascalCase) や `CONFIG.ts` (UPPER) にしない。

## 「揺れ」が既存にある時

- 周辺のファイル / 既存コードに合わせる方を優先 (本ルールより周辺一貫性が上)
- 既存ディレクトリの多数派が PascalCase なら、新規追加もそれに合わせる
- 全体を揃え直したい場合は別ブランチで一括リネーム + import 更新 (片手間で混ぜない)

## プロジェクト固有の拡張

各プロジェクトはこのルールを **基底** として、独自規約を追加して良い:
- `~/Develop/501/.claude/rules/naming.md` — 501 プロジェクト独自 (ジョブパス規約 / schema.org フィールド命名 等)

ただし **基底ルールを上書きしない**。kebab-case の方針は全プロジェクト共通。
