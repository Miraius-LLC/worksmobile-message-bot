## Why

callback endpointはJSON / Zod validationの前にdedup keyを登録するため、不正payloadで400を返してもkeyが残る。同じ不正payloadを5分以内に再送すると、検証されずに200が返り、送信側は受理されたと誤認する。

## What Changes

- JSON parseまたはZod validationで400を返すときにdedup keyを解除する
- 検証順序（署名 → Bot ID → dedup → JSON / Zod → 転送）は変えない
- 正常payloadの重複は従来どおり200で転送をskipする

## Capabilities

### Modified Capabilities

- `callback-delivery`: 不正payloadはdedup windowに残さず、再送しても400を返す

## Impact

- `src/routes/callback.ts`
- `tests/routes/callback.test.ts`
- `README.md`のcallback dedup節
- 観測可能な変化: 同じ不正callback payloadの5分以内の再送が200ではなく400になる
