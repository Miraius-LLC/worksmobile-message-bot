## Why

`fetch`の既定redirect追従では、301 / 302 / 303後にPOSTがGETへ変わり、raw callback bodyが届かない場合がある。最終応答が2xxならwmbotは転送成功と判断し、イベント処理が欠落する。

## What Changes

- callback転送はredirectを自動追従しない
- upstreamの3xx応答とopaque redirect応答を転送失敗として扱い、callback endpointがdedup keyを解除して再投入可能にする

## Capabilities

### Modified Capabilities

- `callback-delivery`: redirect先へ転送せず、3xxとopaque redirectを失敗として扱う

## Impact

- `src/services/lineworks/callback/forward.ts`
- `src/services/lineworks/callback/forward.test.ts`
- 観測可能な変化: upstreamの3xx応答とopaque redirect応答は成功扱いにならず、callback endpointは500を返してdedup keyを解除する
