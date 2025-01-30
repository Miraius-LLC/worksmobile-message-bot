const sendAPIMessage = require("../../middleware/sendAPIMessage");
const { validateQuickReply, validateUrl } = require("../../utils/validates");

/**
 * @function sendFileMessage
 * @description ファイルメッセージを送信する共通ロジック
 *
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（`channelId` の代わりに指定可能）
 * @param {string} [params.channelId] - トークルームID（`userId` の代わりに指定可能）
 * @param {string} [params.originalContentUrl] - ファイルのURL (HTTPSのみ、最大1,000文字)
 * @param {string} [params.fileId] - アップロードされたファイルのID
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 *
 * @throws {Error} 送信先が指定されていない場合 (`userId` または `channelId` が必要)
 * @throws {Error} `originalContentUrl` または `fileId` のいずれかが指定されていない場合
 * @throws {Error} `originalContentUrl` のフォーマットが無効な場合（HTTPSのみ、最大1,000文字）
 * @throws {Error} `quickReply` のフォーマットが無効な場合
 *
 * @returns {Promise<void>} API メッセージ送信を実行し、完了時に `void` を返す
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
    validateUrl(originalContentUrl, "originalContentUrl", 1000);
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
