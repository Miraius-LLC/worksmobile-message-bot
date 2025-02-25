const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateAction,
  validateQuickReply,
  validateStringParam,
} = require("../../utils/validates");

/**
 * @function sendButtonTemplateMessage
 * @description ボタンテンプレートメッセージを送信する共通ロジック
 *
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（`channelId` の代わりに指定可能）
 * @param {string} [params.channelId] - トークルームID（`userId` の代わりに指定可能）
 * @param {string} params.contentText - ボタンテンプレートに表示されるテキスト（必須項目）
 * @param {Array} params.actions - アクションオブジェクトのリスト（必須項目）
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 *
 * @throws {Error} 送信先が指定されていない場合 (`userId` または `channelId` が必要)
 * @throws {Error} `contentText` が指定されていない、または文字列でない場合
 * @throws {Error} `actions` が指定されていない、または 1 つ以上のアクションが必要
 * @throws {Error} `quickReply` のフォーマットが無効な場合
 *
 * @returns {Promise<void>} API メッセージ送信を実行し、完了時に `void` を返す
 */
async function sendButtonTemplateMessage(botId, token, params) {
  const { userId, channelId, contentText, actions, quickReply } = params;

  if (!(userId || channelId)) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  validateStringParam(contentText, "contentText");

  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error(
      "パラメータ 'actions' は必須で、1つ以上のアクションを指定してください。"
    );
  }

  actions.forEach((action, index) => {
    try {
      validateAction(action, false);
    } catch (error) {
      throw new Error(
        `アクション ${index + 1} の検証に失敗しました: ${error.message}`
      );
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
      type: "button_template",
      contentText,
      actions,
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendButtonTemplateMessage;
