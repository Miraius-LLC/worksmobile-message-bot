const sendAPIMessage = require("../../middleware/sendAPIMessage");
const validateQuickReply = require("../../utils/validateQuickReply");

/**
 * スタンプメッセージを送信する共通ロジック
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（任意）
 * @param {string} [params.channelId] - トークルームID（任意）
 * @param {string} params.packageId - スタンプのパッケージID
 * @param {string} params.stickerId - スタンプID
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 * @throws {Error} パラメータが不正または検証に失敗した場合
 */
async function sendStickerMessage(botId, token, params) {
  const { userId, channelId, packageId, stickerId, quickReply } = params;

  // 送信先の検証
  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  // スタンプの検証
  if (!packageId || typeof packageId !== "string") {
    throw new Error(
      "パラメータ 'packageId' は必須で、文字列を指定してください。"
    );
  }

  if (!stickerId || typeof stickerId !== "string") {
    throw new Error(
      "パラメータ 'stickerId' は必須で、文字列を指定してください。"
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
      type: "sticker",
      packageId,
      stickerId,
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendStickerMessage;
