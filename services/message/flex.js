const sendAPIMessage = require("../../middleware/sendAPIMessage");
const validateQuickReply = require("../../utils/validateQuickReply");

/**
 * フレックスメッセージを送信する共通ロジック
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（任意）
 * @param {string} [params.channelId] - トークルームID（任意）
 * @param {string} params.altText - トークルームリストとプッシュ通知で表示される代替テキスト。最大400文字。必須項目。
 * @param {Object} params.contents - Flexible Template コンテナ。必須項目。
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 * @throws {Error} パラメータが不正または検証に失敗した場合
 */
async function sendFlexMessage(botId, token, params) {
  const { userId, channelId, altText, contents, quickReply } = params;

  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  if (!altText || typeof altText !== "string" || altText.length > 400) {
    throw new Error(
      "'altText' は必須で、文字列形式で最大400文字以内で指定してください。"
    );
  }

  if (!contents || typeof contents !== "object") {
    throw new Error(
      "'contents' は必須で、オブジェクト形式で指定してください。"
    );
  }

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
