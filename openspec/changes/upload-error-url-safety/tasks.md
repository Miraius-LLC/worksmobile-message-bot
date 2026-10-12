## Upload例外の安全化

- [x] 1.1 HTTP uploadのtimeoutを500本文とログに出さない回帰testをREDにし、serviceで固定エラーへ変換して緑を確認する
- [x] 1.2 URLを含む通信例外でも漏出しないtestを確認する
- [x] 1.3 全suite・typecheck・biome・OpenSpec strict validationを通し、TODOとCHANGELOGを更新する
