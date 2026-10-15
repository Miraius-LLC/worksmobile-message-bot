## Context

[429の変更](../archive/2026-10-12-callback-forward-rate-limit/design.md)で429を失敗経路へ含めたが、408はその他4xx経路に残り、warnしてreturnするためcallback endpointが200を返してdedup keyを残す。

## Decision

408を429・5xxと同じ既存の失敗経路へ含める。serviceがログを記録してthrowし、既存callback routeの後始末でdedup keyをunregisterして500を返す。route自体の変更は不要。その他4xxの扱いは変更しない。内部retry、待機、永続queueは追加しない。

同一payloadが408で繰り返し失敗しても毎回転送され、upstreamが回復すれば再投入が200となることを、429と同じHTTP境界テストで検証する。LINE WORKSによる自動再送は保証しない。

## Rollback

408を失敗経路から外し、対応するテストとREADMEの408記述を戻す。元の未配送callbackを成功扱いするリスクも戻る。
