## Callback転送のrate limit対応

- [x] 1.1 HTTP境界で429時の500と同一payload再投入を検証する回帰テストを追加し、REDを確認してから429を転送失敗として実装しGREENを確認する
- [x] 1.2 HTTP回帰テストでserviceの429 throwとdedup解除を検証し、既存statusのテストも確認して、README・冒頭コメント・CHANGELOGを更新する
- [x] 1.3 spec:validate・全テスト・typecheck・Biomeを通し、commit済み候補の独立reviewへ渡す
