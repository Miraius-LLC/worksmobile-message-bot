const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateAction,
  validateQuickReply,
  validateImageUrl,
} = require("../../utils/validates");

/**
 * @function sendImageCarouselMessage
 * @description 画像カルーセルメッセージを送信する共通ロジック
 *
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（`channelId` の代わりに指定可能）
 * @param {string} [params.channelId] - トークルームID（`userId` の代わりに指定可能）
 * @param {Array} params.columns - 画像カルーセルのオブジェクトリスト（最大10個）
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 *
 * @throws {Error} 送信先が指定されていない場合 (`userId` または `channelId` が必要)
 * @throws {Error} `columns` が指定されていない、または 1つ以上の項目が必要
 * @throws {Error} `columns` の配列長が 10 を超える場合
 * @throws {Error} `originalContentUrl` または `fileId` のいずれか一方が必須です。
 * @throws {Error} `quickReply` のフォーマットが無効な場合
 *
 * @returns {Promise<void>} API メッセージ送信を実行し、完了時に `void` を返す
 */
async function sendImageCarouselMessage(botId, token, params) {
  const { userId, channelId, columns, quickReply } = params;

  if (!(userId || channelId)) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error(
      "パラメータ 'columns' は必須で、1つ以上の項目を指定してください。"
    );
  }
  if (columns.length > 10) {
    throw new Error("パラメータ 'columns' の配列長は最大10個までです。");
  }

  columns.forEach((column, index) => {
    // originalContentUrl または fileId のいずれかが必須
    if (!(column.originalContentUrl || column.fileId)) {
      throw new Error(
        `カラム ${
          index + 1
        } には 'originalContentUrl' または 'fileId' のいずれかが必要です。`
      );
    }
    if (column.originalContentUrl) {
      validateImageUrl(
        column.originalContentUrl,
        `columns[${index}].originalContentUrl`
      );
    }

    if (column.action) {
      try {
        validateAction(column.action, false);
      } catch (error) {
        throw new Error(
          `カラム ${index + 1} のアクションが無効です: ${error.message}`
        );
      }
    }
  });

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
