## Why

upstreamの408をその他4xxとして成功扱いすると、未配送callbackに200を返してdedup keyを保持し、同じpayloadを再投入できない。408はRFC 9110で同じ要求を繰り返してよい一時障害であり、429と同じく配送成功を確認できない。

## What Changes

- upstreamの408を転送失敗としてthrowし、callback endpointが500を返してdedup keyを解除する
- 401 / 403 / 408 / 429以外の4xxの扱いとLINE WORKSの自動再送を前提にしない方針は維持する

## Capabilities

### Modified Capabilities

- `callback-delivery`: upstreamの408を転送失敗として扱う

## Impact

- `src/services/lineworks/callback/forward.ts`とservice / routeの回帰テスト
- READMEのcallback節とCHANGELOG
- 観測可能な変化: upstreamの408に対してcallback endpointが200ではなく500を返し、同じpayloadを再投入できる
