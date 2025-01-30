const sendAPIMessage = require("../../middleware/sendAPIMessage");
const validateQuickReply = require("../../utils/validateQuickReply");

/**
 * 画像メッセージを送信する共通ロジック
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（任意）
 * @param {string} [params.channelId] - トークルームID（任意）
 * @param {string} [params.previewImageUrl] - プレビュー画像のURL (HTTPS のみ、最大1,000文字)。
 * @param {string} [params.originalContentUrl] - 元画像のURL (HTTPS のみ、最大1,000文字)。
 * @param {string} [params.fileId] - アップロードされた画像のファイルID。必須項目。
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）。
 * @throws {Error} パラメータが不正または検証に失敗した場合
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

  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  if (!previewImageUrl && !originalContentUrl && !fileId) {
    throw new Error(
      "パラメータ 'previewImageUrl'、'originalContentUrl'、'fileId' のいずれかを指定してください。"
    );
  }

  /**
   * 画像URLの検証 (HTTPS チェックと最大文字数チェックのみ)
   * @param {string} url - 検証対象のURL
   * @param {string} paramName - パラメータ名
   * @throws {Error} URLがHTTPS以外、または長さが1000文字を超える場合にエラーをスロー
   */
  const validateImageUrl = (url, paramName) => {
    if (!/^https:\/\//.test(url)) {
      throw new Error(
        `パラメータ '${paramName}' は HTTPS のURLを指定してください。`
      );
    }
    if (url.length > 1000) {
      throw new Error(
        `パラメータ '${paramName}' は1,000文字以内で指定してください。`
      );
    }
  };

  if (previewImageUrl) {
    validateImageUrl(previewImageUrl, "previewImageUrl");
  }
  if (originalContentUrl) {
    validateImageUrl(originalContentUrl, "originalContentUrl");
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
