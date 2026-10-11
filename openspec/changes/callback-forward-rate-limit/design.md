## Context

`forward.ts`はupstreamのstatusを、成功・転送失敗（throw）・再試行対象外（警告ログのみ）に分ける。401 / 403を除く4xxは「再送しても解決しない」ため再試行対象外にしている。429はこの前提に当たらず、待てば通る。転送失敗の扱い（500、dedup key解除、手動再投入）は[ADR-0005](../../../docs/adr/0005-forward-callback-to-upstream.md)のとおりで、変えない。

## Decision

429を5xxと同じ転送失敗の分岐へ入れる。分岐を足さず、5xxの条件を広げてログと例外の形を揃える。

- 既存requirement「設定可能なupstreamへ同期転送する」は`callback-forward-redirect-safety`が同時にMODIFIEDしている。本changeはADDED requirementにして、どちらを先にarchiveしても互いの変更を落とさない
- `Retry-After`の解釈と自動再試行は扱わない。LINE WORKSの再送契約は前提にしない（ADR-0005）
- 408 / 425など429以外の一時的な4xxは扱わない。観測も指摘も無い

## Rollback

`forward.ts`の転送失敗の条件から429を外す。
