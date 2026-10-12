## Callback転送のredirect安全化

- [x] 1.1 301 / 302 / 303で転送成功扱いにならないテストを追加し、修正前に失敗することを確認する
- [x] 1.2 callback転送に`redirect: 'manual'`を指定し、全3xxをthrowする
- [x] 1.3 301 / 302 / 303テストが通り、既存の2xx / 4xx / 5xx挙動も保たれることを確認する
- [x] 1.4 `response.type === 'opaqueredirect'`（status 0）も転送失敗にするテストを追加し、修正前に失敗することを確認して直す
- [x] 1.5 `bun run test`、`bun run typecheck`、`bun run lint`、`bun run spec:validate`を実行し、CHANGELOGに記録する
