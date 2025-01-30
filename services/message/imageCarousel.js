const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateAction,
  validateActionObject,
} = require("../../utils/validateAction");
const validateQuickReply = require("../../utils/validateQuickReply");

/**
 * 画像カルーセルメッセージを送信する共通ロジック
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（任意）
 * @param {string} [params.channelId] - トークルームID（任意）
 * @param {Array} params.columns - 画像カルーセルのオブジェクトリスト（最大10個）
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 * @throws {Error} パラメータが不正または検証に失敗した場合
 */
async function sendImageCarouselMessage(botId, token, params) {
  const { userId, channelId, columns, quickReply } = params;

  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    throw new Error(
      "パラメータ 'columns' は必須で、1つ以上の項目を指定してください。"
    );
  }
  if (columns.length > 10) {
    throw new Error("パラメータ 'columns' の配列長は最大10個までです。");
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

  for (const [index, column] of columns.entries()) {
    if (!column.originalContentUrl) {
      throw new Error(
        `カラム ${index + 1} には 'originalContentUrl' が必要です。`
      );
    }

    validateImageUrl(
      column.originalContentUrl,
      `columns[${index}].originalContentUrl`
    );

    if (column.action) {
      try {
        validateAction(column.action, false);
      } catch (error) {
        throw new Error(
          `カラム ${index + 1} のアクションが無効です: ${error.message}`
        );
      }
    }
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
      type: "image_carousel",
      columns,
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendImageCarouselMessage;
