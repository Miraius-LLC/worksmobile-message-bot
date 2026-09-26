## 1. 不正payloadのdedup key解除

- [x] 1.1 同じ不正payload（JSON parse不能 / Zod検証NG）を2回送り、2回とも400を期待するテストを追加し、2回目が200で失敗することを確認する
- [x] 1.2 JSON parse失敗とZod検証失敗の400分岐で`unregister(dedupKey)`を呼び、テストを通す
- [x] 1.3 正常payloadの重複が200でskipされる既存テストが通ることを確認する
- [x] 1.4 README / AGENTS.md / callback routeの説明を同期し、`bun test`、`bunx tsc --noEmit`、`bun run lint`、`bun run spec:validate`を実行する
