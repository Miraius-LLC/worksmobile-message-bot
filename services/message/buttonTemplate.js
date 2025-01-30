const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateAction,
  validateActionObject,
} = require("../../utils/validateAction");
const validateQuickReply = require("../../utils/validateQuickReply");

/**
 * ボタンテンプレートメッセージを送信する共通ロジック
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（任意）
 * @param {string} [params.channelId] - トークルームID（任意）
 * @param {string} params.contentText - ボタンテンプレートに表示されるテキスト。必須項目。
 * @param {Array} params.actions - アクションオブジェクトのリスト。必須項目。
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）。
 * @throws {Error} パラメータが不正または検証に失敗した場合
 */
async function sendButtonTemplateMessage(botId, token, params) {
  const { userId, channelId, contentText, actions, quickReply } = params;

  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  if (
    !contentText ||
    typeof contentText !== "string" ||
    contentText.length === 0
  ) {
    throw new Error(
      "パラメータ 'contentText' は必須で、文字列形式で指定してください。"
    );
  }

  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    throw new Error(
      "パラメータ 'actions' は必須で、1つ以上のアクションを指定してください。"
    );
  }

  for (const [index, action] of actions.entries()) {
    try {
      validateAction(action, false);
    } catch (error) {
      throw new Error(
        `アクション ${index + 1} の検証に失敗しました: ${error.message}`
      );
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
      type: "button_template",
      contentText,
      actions,
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendButtonTemplateMessage;
