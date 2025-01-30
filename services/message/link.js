const sendAPIMessage = require("../../middleware/sendAPIMessage");
const validateQuickReply = require("../../utils/validateQuickReply");

/**
 * リンクメッセージを送信する共通ロジック
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（任意）
 * @param {string} [params.channelId] - トークルームID（任意）
 * @param {string} params.contentText - 本文のテキスト。必須項目。
 * @param {string} params.linkText - リンクのテキスト。必須項目。
 * @param {string} params.link - クリック時の遷移先URL。必須項目。
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 * @throws {Error} パラメータが不正または検証に失敗した場合
 */
async function sendLinkMessage(botId, token, params) {
  const { userId, channelId, contentText, linkText, link, quickReply } = params;

  // 送信先の検証
  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  // テキストの検証
  if (
    !contentText ||
    typeof contentText !== "string" ||
    contentText.length > 1000
  ) {
    throw new Error(
      "'contentText' は必須で、1,000文字以内の文字列を指定してください。"
    );
  }

  if (!linkText || typeof linkText !== "string" || linkText.length > 1000) {
    throw new Error(
      "'linkText' は必須で、1,000文字以内の文字列を指定してください。"
    );
  }

  // リンクの検証
  if (
    !link ||
    typeof link !== "string" ||
    !/^https?:\/\//.test(link) ||
    link.length > 1000
  ) {
    throw new Error(
      "'link' は有効なURL形式 (http または https) であり、最大1,000文字以内で指定してください。"
    );
  }

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
