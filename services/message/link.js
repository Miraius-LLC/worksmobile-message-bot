const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateQuickReply,
  validateStringParam,
  validateUrl,
} = require("../../utils/validates");

/**
 * @function sendLinkMessage
 * @description リンクメッセージを送信する共通ロジック
 *
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（`channelId` の代わりに指定可能）
 * @param {string} [params.channelId] - トークルームID（`userId` の代わりに指定可能）
 * @param {string} params.contentText - 本文のテキスト（必須項目、最大1,000文字）
 * @param {string} params.linkText - リンクのテキスト（必須項目、最大1,000文字）
 * @param {string} params.link - クリック時の遷移先URL（必須項目、HTTPまたはHTTPSのみ、最大1,000文字）
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 *
 * @throws {Error} 送信先が指定されていない場合 (`userId` または `channelId` が必要)
 * @throws {Error} `contentText` または `linkText` が指定されていない、または1,000文字を超える場合
 * @throws {Error} `link` のフォーマットが無効な場合（HTTPまたはHTTPSのみ、最大1,000文字）
 * @throws {Error} `quickReply` のフォーマットが無効な場合
 *
 * @returns {Promise<void>} API メッセージ送信を実行し、完了時に `void` を返す
 */
async function sendLinkMessage(botId, token, params) {
  const { userId, channelId, contentText, linkText, link, quickReply } = params;

  if (!(userId || channelId)) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  validateStringParam(contentText, "contentText", 1000);
  validateStringParam(linkText, "linkText", 1000);
  validateUrl(link, "link", 1000);

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
      type: "link",
      contentText,
      linkText,
      link,
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendLinkMessage;
