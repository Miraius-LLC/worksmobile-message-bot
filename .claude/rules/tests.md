# テスト規約（Develop 共通）

変更の影響が出る境界で振る舞いを検証します。repo-local の `AGENTS.md` / `CLAUDE.md`、設定、package scriptが具体的なら、そのrepoのrunnerと指示を優先します。

- Bun / TypeScript のテストは `bun:test` を使い、`bun test <file>` のfocused testから `bun test` の全体suiteへ広げます。他のstackではrepoが設定したrunnerを使います。
- 外部API、実Secret Manager、実JWT署名はテストから呼びません。fixtureやmockで境界を置き換え、結果と副作用を検証します。
- Bunの `mock.module` はmock設定後にSUTを `await import(...)` します。mockは他のtest fileへ残ることがあるため、file評価順に依存するテストを作りません。
- 環境変数・時計・一時fileを変更するtestは、test専用の値を使い、`finally` / teardownで元へ戻します。実credentialをfixtureや出力へ含めません。
- 実行したい検査はrepoの `package.json` scriptを使います。`lefthook.yml` と `.lefthook/pre-push/` を読み、hookが実行する範囲を確認します。pre-commitが通っても全suiteが実行されたとは限らないため、必要な未実行検査を明示的に走らせます。

来歴（出典。配布先から参照する手順ではありません）: `develop-meta/AGENTS.md` §3.1、`develop-meta/docs/develop-testing.md`。
