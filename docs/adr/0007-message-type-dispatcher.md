# メッセージ型 dispatcher（個別 sender なし）

メッセージ送信は **型ごとの個別 sender 関数を書かず**、`services/lineworks/messages/index.ts` の `messageSchemas` マップ（type → Zod schema）+ 汎用 `sendMessageByType` で処理する。`sendMessageByType` は検証済み body を `{ type, ...body }` の wire format に組み立てて POST する。`routes/messages.ts` のループがこのマップを走査し、両 base（channels / users）× 全 type を `(channels|users)/:id/messages/type/<type>` として自動登録する。新しいメッセージ型は **schema を 1 件足すだけ**でルート登録・送信が通る（boilerplate の重複を避ける）。LINE WORKS の wire format に揃わない型だけ schema 側で `.transform()` する。

_出典: CLAUDE.md 注意点（命名・配置）/ services.md messages, routes.md メッセージ系エンドポイント_
