# Design

B1はREADMEのfileId単独契約をZod refineで検証する。B2はFetchTimeoutError構築時だけURLを正規化してuserinfo/query/fragmentを削り、parse不能時は[invalid-url]とする。送信URL、timeout、本文stream、cancel、caller signalの処理は維持する。

# Verification and rollback

既存のmessageSchemas.safeParseとfetchWithTimeout/FetchTimeoutErrorを公開境界として検証する。各focused test、spec:validate、bun run checkを実行する。変更はB1/B2の2commitに分け、rollbackは対応commitをrevertする。
