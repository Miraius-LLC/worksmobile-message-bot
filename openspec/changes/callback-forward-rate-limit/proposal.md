## Why

upstreamの429をその他4xxとして成功扱いすると、未配送callbackに200を返してdedup keyを保持し、同じpayloadを再投入できない。

## What Changes

- upstreamの429を転送失敗としてthrowし、callback endpointが500を返してdedup keyを解除する
- 429以外の4xxの扱いとLINE WORKSの自動再送を前提にしない方針は維持する

## Capabilities

### Modified Capabilities

- `callback-delivery`: upstreamの429を転送失敗として扱う

## Impact

- `src/services/lineworks/callback/forward.ts`とservice / routeの回帰テスト
- READMEのcallback節とCHANGELOG
- 観測可能な変化: upstreamの429に対してcallback endpointが200ではなく500を返し、同じpayloadを再投入できる
