const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateAction,
  validateActionObject,
} = require("../../utils/validateAction");

/**
 * カルーセルメッセージを送信する共通ロジック
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
