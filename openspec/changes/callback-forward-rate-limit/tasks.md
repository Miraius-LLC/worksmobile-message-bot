## upstreamの429を転送失敗にする

- [x] 1.1 upstreamが429を返す転送テスト（`forward.test.ts`）と、429の後に同じcallbackを再投入できるrouteテスト（`tests/routes/callback.test.ts`）を追加し、修正前に失敗することを確認する
- [x] 1.2 `forward.ts`の転送失敗の条件に429を加え、1.1のテストを通す
- [x] 1.3 429以外の4xx（400 / 404）が転送失敗にならないこと、5xx・302の既存テストが通ることを確認する
- [ ] 1.4 README / callback routeとforward.tsの説明を同期し、CHANGELOGに記録し、`bun run typecheck`、`bun run lint`、`bun run spec:validate`を実行する
