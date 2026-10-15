## Callback転送の408対応

- [x] 1.1 serviceの408 throwを検証する回帰テストを追加し、408を失敗経路から外すとREDになることを確認してGREENを確認する
- [x] 1.2 HTTP境界で408時の500と同一payload再投入・回復後200を429と同じテストで検証し、README・冒頭コメント・CHANGELOGを更新する
- [x] 1.3 spec:validate・全テスト・typecheck・Biomeを通し、commit済み候補の独立reviewへ渡す
