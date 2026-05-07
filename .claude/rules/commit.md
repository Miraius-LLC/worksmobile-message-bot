# コミットメッセージ規約

git commit の subject 行は **絵文字 (gitmoji) + 半角スペース + 本文** で書く。

- shortcode (`:zap:`) や Conventional Commits の type prefix (`perf:`) は使わない
- 主要な変更を表す絵文字 1 個だけ。複数並べない (`⚡️ + 🐛` ❌)
- 本文 (body) には絵文字は不要、subject 行のみ
- `Co-Authored-By:` フッタはこれまで通り変更なし
- `Merge pull request #...` 等の Git 自動生成メッセージは対象外

## 絵文字対応表

| 絵文字 | 用途 |
|--------|------|
| ✨ | 新機能・新エンドポイント追加 |
| 🐛 | バグ修正 |
| ⚡️ | パフォーマンス改善 |
| ♻️ | リファクタ (挙動変えない) |
| 🔧 | 設定ファイル変更 (config / biome / tsconfig / lefthook 等) |
| 🔨 | ビルド・ツール周り (Dockerfile / scripts) |
| 📝 | ドキュメント (README / コメント) |
| 🚀 | デプロイ関連 |
| 🔥 | 不要コード/ファイル削除 |
| 🙈 | .gitignore 変更 |
| ➕ | 依存追加 |
| ⬆️ | 依存アップデート |
| ⬇️ | 依存ダウングレード |
| 🚨 | lint/typecheck エラー修正 |
| ✅ | テスト追加・修正 |
| 🔒 | セキュリティ修正 |
| 💄 | UI/スタイル調整 |
| 🏷️ | 型定義の変更 |
| 🚚 | ファイル/ディレクトリ移動・リネーム |
| 🩹 | 軽微な修正 (typo 等) |

## 例

```
✨ flex メッセージのクイックリプライ対応を追加
🐛 添付ファイルダウンロード時の Content-Disposition 引き継ぎを修正
♻️ middleware/ を src/services/lineworks/ に集約
🔨 Dockerfile を oven/bun ベースに刷新
🙈 build/ を gitignore に追加
🔥 fastify-multer / multer の依存を削除
```
