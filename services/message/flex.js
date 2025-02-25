const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateQuickReply,
  validateStringParam,
} = require("../../utils/validates");

/**
 * @function sendFlexMessage
 * @description フレックスメッセージを送信する共通ロジック
 *
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（`channelId` の代わりに指定可能）
 * @param {string} [params.channelId] - トークルームID（`userId` の代わりに指定可能）
 * @param {string} params.altText - トークルームリストとプッシュ通知で表示される代替テキスト（最大400文字）
 * @param {Object} params.contents - Flexible Template コンテナ（必須項目）
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 *
 * @throws {Error} 送信先が指定されていない場合 (`userId` または `channelId` が必要)
 * @throws {Error} `altText` が指定されていない、または 400 文字を超える場合
 * @throws {Error} `contents` のフォーマットが無効な場合（オブジェクトのみ許容）
 * @throws {Error} `quickReply` のフォーマットが無効な場合
 *
 * @returns {Promise<void>} API メッセージ送信を実行し、完了時に `void` を返す
 */
async function sendFlexMessage(botId, token, params) {
  const { userId, channelId, altText, contents, quickReply } = params;

  if (!(userId || channelId)) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  validateStringParam(altText, "altText", 400);

  // contents の検証
  if (!contents || typeof contents !== "object") {
    throw new Error(
      "'contents' は必須で、オブジェクト形式で指定してください。"
    );
  }

  // クイックリプライの検証
  if (quickReply) {
    if (typeof quickReply !== "object") {
      throw new Error(
        "パラメータ 'quickReply' はオブジェクト形式で指定してください。"
      );
    }
    try {
      validateQuickReply(quickReply);
    } catch (error) {
      throw new Error(`クイックリプライの検証に失敗しました: ${error.message}`);
    }
  }

  const target = userId
    ? `users/${userId}/messages`
    : `channels/${channelId}/messages`;
  const url = `https://www.worksapis.com/v1.0/bots/${botId}/${target}`;

  const payload = {
    content: {
      type: "flex",
      altText,
      contents,
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendFlexMessage;
