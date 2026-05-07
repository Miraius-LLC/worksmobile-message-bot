/** メッセージ送信先 (channelId / userId のどちらか) */
export type MessageTarget = { channelId: string } | { userId: string }

/** メッセージ送信関数の共通シグネチャ。`TBody` は Zod schema から `z.infer` で導出する */
export type MessageSender<TBody = unknown> = (
  botId: string,
  token: string,
  target: MessageTarget,
  body: TBody,
) => Promise<void>
