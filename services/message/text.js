const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateQuickReply,
  validateStringParam,
} = require("../../utils/validates");

/**
 * @function sendTextMessage
 * @description テキストメッセージを送信する共通ロジック
 *
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（`channelId` の代わりに指定可能）
 * @param {string} [params.channelId] - トークルームID（`userId` の代わりに指定可能）
 * @param {string} params.text - 送信するテキスト（必須項目、最大2000文字）
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 *
 * @throws {Error} 送信先が指定されていない場合 (`userId` または `channelId` が必要)
 * @throws {Error} `text` が指定されていない、または文字列でない場合
 * @throws {Error} `text` の長さが 2000 文字を超える場合
 * @throws {Error} `quickReply` のフォーマットが無効な場合
 *
 * @returns {Promise<void>} API メッセージ送信を実行し、完了時に `void` を返す
 */
async function sendTextMessage(botId, token, params) {
  const { userId, channelId, text, quickReply } = params;

  if (!(userId || channelId)) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  // テキストメッセージのバリデーション（最大2000文字）
  validateStringParam(text, "text", 2000);

  // クイックリプライのバリデーション
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

  // API 送信設定
  const target = userId
    ? `users/${userId}/messages`
    : `channels/${channelId}/messages`;
  const url = `https://www.worksapis.com/v1.0/bots/${botId}/${target}`;

  const payload = {
    content: {
      type: "text",
      text,
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendTextMessage;
