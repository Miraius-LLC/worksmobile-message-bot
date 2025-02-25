const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateQuickReply,
  validateImageUrl,
} = require("../../utils/validates");

/**
 * @function sendImageMessage
 * @description 画像メッセージを送信する共通ロジック
 *
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（`channelId` の代わりに指定可能）
 * @param {string} [params.channelId] - トークルームID（`userId` の代わりに指定可能）
 * @param {string} [params.previewImageUrl] - プレビュー画像のURL (HTTPS のみ、最大1,000文字)
 * @param {string} [params.originalContentUrl] - 元画像のURL (HTTPS のみ、最大1,000文字)
 * @param {string} [params.fileId] - アップロードされた画像のファイルID（必須項目）
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 *
 * @throws {Error} 送信先が指定されていない場合 (`userId` または `channelId` が必要)
 * @throws {Error} `previewImageUrl`、`originalContentUrl`、`fileId` のいずれかが指定されていない場合
 * @throws {Error} `previewImageUrl` または `originalContentUrl` のフォーマットが無効な場合（HTTPSのみ）
 * @throws {Error} `quickReply` のフォーマットが無効な場合
 *
 * @returns {Promise<void>} API メッセージ送信を実行し、完了時に `void` を返す
 */
async function sendImageMessage(botId, token, params) {
  const {
    userId,
    channelId,
    previewImageUrl,
    originalContentUrl,
    fileId,
    quickReply,
  } = params;

  if (!(userId || channelId)) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  const hasImageSource = [previewImageUrl, originalContentUrl, fileId].some(Boolean);
  if (!hasImageSource) {
    throw new Error(
      "パラメータ 'previewImageUrl'、'originalContentUrl'、'fileId' のいずれかを指定してください。"
    );
  }

  if (previewImageUrl) validateImageUrl(previewImageUrl, "previewImageUrl");
  if (originalContentUrl)
    validateImageUrl(originalContentUrl, "originalContentUrl");

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
      type: "image",
      ...(previewImageUrl && { previewImageUrl }),
      ...(originalContentUrl && { originalContentUrl }),
      ...(fileId && { fileId }),
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendImageMessage;
