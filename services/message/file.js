const sendAPIMessage = require("../../middleware/sendAPIMessage");
const validateQuickReply = require("../../utils/validateQuickReply");

/**
 * ファイルメッセージを送信する共通ロジック
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（任意）
 * @param {string} [params.channelId] - トークルームID（任意）
 * @param {string} [params.originalContentUrl] - ファイルのURL (HTTPSのみ、PNG形式)。最大1,000文字。
 * @param {string} [params.fileId] - アップロードされたファイルのID。
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）。
 * @throws {Error} パラメータが不正または検証に失敗した場合
 */
async function sendFileMessage(botId, token, params) {
  const { userId, channelId, originalContentUrl, fileId, quickReply } = params;

  // 送信先の検証
  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  // ファイルデータの検証
  if (!originalContentUrl && !fileId) {
    throw new Error(
      "パラメータ 'originalContentUrl' または 'fileId' のいずれかを指定してください。"
    );
  }

  // originalContentUrl の検証
  if (originalContentUrl) {
    if (!/^https:\/\//.test(originalContentUrl)) {
      throw new Error(
        "パラメータ 'originalContentUrl' は HTTPS のURLを指定してください。"
      );
    }
    if (originalContentUrl.length > 1000) {
      throw new Error(
        "パラメータ 'originalContentUrl' は1,000文字以内で指定してください。"
      );
    }
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
      type: "file",
      ...(originalContentUrl && { originalContentUrl }),
      ...(fileId && { fileId }),
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendFileMessage;
