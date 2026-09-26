## Context

`src/routes/callback.ts`はdedupを`checkAndRegister`で確認と登録を同時に行い、その後にJSON / Zod validationを行う。転送失敗時は既に`unregister`でkeyを解除している。

## Decisions

### 400の分岐でkeyを解除する

validationを登録前へ移す案もあるが、文書化済みの検証順序（ADR-0004 / README / current spec）を変えずに済むよう、転送失敗時と同じ`unregister`を400の分岐でも呼ぶ。`checkAndRegister`から400の返却までにawaitはないため、同一instance内で解除前に別requestが割り込むことはない。

## Risks / Trade-offs

- 不正payloadの再送は毎回JSON / Zod validationを通る。payloadは署名検証済みで、validationは同期処理なので負荷上の問題はない。

## Rollback

`src/routes/callback.ts`の`unregister`呼出し2か所を戻す。
