/** メッセージ送信先 (どちらか必須) */
export type MessageTarget = {
  channelId?: string
  userId?: string
}

/** クイックリプライ */
export type QuickReplyAction = {
  type: ActionType
  label?: string
  postback?: string
  uri?: string
  copyText?: string
  [key: string]: unknown
}

export type QuickReplyItem = {
  imageUrl?: string
  action: QuickReplyAction
}

export type QuickReply = {
  items: QuickReplyItem[]
}

/** アクション (postback / message / uri / camera / cameraRoll / location / copy) */
export type ActionType =
  | 'postback'
  | 'message'
  | 'uri'
  | 'camera'
  | 'cameraRoll'
  | 'location'
  | 'copy'

export type Action = {
  type: ActionType
  label?: string
  postback?: string
  uri?: string
  copyText?: string
  [key: string]: unknown
}

/** 全エンドポイントの送信ペイロード共通 */
export type MessageRequestParams = MessageTarget & {
  quickReply?: QuickReply
  [key: string]: unknown
}

/** メッセージサービスのシグネチャ */
export type MessageSender = (
  botId: string,
  token: string,
  params: MessageRequestParams,
) => Promise<void>
