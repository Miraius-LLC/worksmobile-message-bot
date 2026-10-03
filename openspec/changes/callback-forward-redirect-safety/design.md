## Context

callback upstreamへの転送ではredirectを追従しない。実行環境によっては`redirect: 'manual'`がstatus 0の`opaqueredirect`を返し、通常のstatus判定を通り抜ける。

## Decision

`opaqueredirect`を転送失敗としてthrowし、通常の3xxも転送失敗として扱う。redirect先へcallback bodyや認証情報を意図せず送らない。

## Rollback

`src/services/lineworks/callback/forward.ts`のredirect関連判定と`redirect: 'manual'`を戻す。
