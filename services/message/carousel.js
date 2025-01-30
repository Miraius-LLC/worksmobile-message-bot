const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateAction,
  validateActionObject,
} = require("../../utils/validates");

/**
 * @function sendCarouselMessage
 * @description カルーセルメッセージを送信する共通ロジック
 *
 * @param {string} botId - ボットの ID。
 * @param {string} token - API 呼び出し用のアクセストークン。
 * @param {Object} params - メッセージのパラメータ。
 * @param {string} [params.userId] - 送信先のユーザー ID（`channelId` の代わりに指定可能）。
 * @param {string} [params.channelId] - 送信先のチャンネル ID（`userId` の代わりに指定可能）。
 * @param {string} [params.imageAspectRatio="rectangle"] - 画像の比率 (`rectangle` または `square`)。
 * @param {string} [params.imageSize="cover"] - 画像のサイズ (`cover` または `contain`)。
 * @param {Array} params.columns - カルーセルのカラムリスト（最大10個）。
 *
 * @throws {Error} 送信先が指定されていない場合 (`userId` または `channelId` が必要)。
 * @throws {Error} `columns` が指定されていない、または空の場合。
 * @throws {Error} `columns` の数が 10 を超える場合。
 * @throws {Error} 各カラムの必須項目 (`originalContentUrl` または `fileId`, `text`, `actions`) が不足している場合。
 * @throws {Error} `defaultAction` または `actions` のフォーマットが無効な場合。
 *
 * @returns {Promise<void>} API メッセージ送信を実行し、完了時に `void` を返す。
 */
async function sendCarouselMessage(botId, token, params) {
  const {
    userId,
    channelId,
    imageAspectRatio = "rectangle",
    imageSize = "cover",
    columns,
  } = params;

  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error(
      "パラメータ 'columns' は必須で、1つ以上の項目を指定してください。"
    );
  }
  if (columns.length > 10) {
    throw new Error("カルーセルのカラム数は最大10個までです。");
  }

  columns.forEach((column, index) => {
    if (
      (!column.originalContentUrl && !column.fileId) ||
      !column.text ||
      !Array.isArray(column.actions)
    ) {
      throw new Error(
        `カラム ${
          index + 1
        } には 'originalContentUrl' または 'fileId', 'text', 'actions' が必要です。`
      );
    }

    if (column.defaultAction) {
      try {
        validateActionObject(
          column.defaultAction,
          `カラム ${index + 1} の 'defaultAction'`,
          true
        );
      } catch (error) {
        throw new Error(
          `カラム ${index + 1} の 'defaultAction' が無効です: ${error.message}`
        );
      }
    }

    column.actions.forEach((action, actionIndex) => {
      try {
        validateAction(action, false);
      } catch (error) {
        throw new Error(
          `カラム ${index + 1} の 'actions' のアクション ${
            actionIndex + 1
          } が無効です: ${error.message}`
        );
      }
    });
  });

  const target = userId
    ? `users/${userId}/messages`
    : `channels/${channelId}/messages`;
  const url = `https://www.worksapis.com/v1.0/bots/${botId}/${target}`;

  const payload = {
    content: {
      type: "carousel",
      imageAspectRatio,
      imageSize,
      columns,
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendCarouselMessage;
