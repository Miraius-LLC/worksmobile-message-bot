const sendAPIMessage = require("../../middleware/sendAPIMessage");
const validateQuickReply = require("../../utils/validateQuickReply");

/**
 * メッセージを送信する共通ロジック
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（任意）
 * @param {string} [params.channelId] - トークルームID（任意）
 * @param {string} params.text - 送信するテキスト
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 * @throws {Error} パラメータが不正または検証に失敗した場合
 */
async function sendTextMessage(botId, token, params) {
  const { userId, channelId, text, quickReply } = params;

  // 送信先の検証
  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  // テキストの検証
  if (!text || typeof text !== "string") {
    throw new Error("パラメータ 'text' は必須で、文字列を指定してください。");
  }

  if (text.length > 2000) {
    throw new Error("パラメータ 'text' は2000文字以内で指定してください。");
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
      type: "text",
      text,
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendTextMessage;
