const sendAPIMessage = require("../../middleware/sendAPIMessage");
const {
  validateAction,
  validateActionObject,
} = require("../../utils/validateAction");
const validateQuickReply = require("../../utils/validateQuickReply");

/**
 * リストテンプレートメッセージを送信する共通ロジック
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（任意）
 * @param {string} [params.channelId] - チャンネルID（任意）
 * @param {Object} [params.coverData] - カバー画像データ（任意）
 * @param {Array} params.elements - リスト項目の配列（必須）
 * @param {Array} [params.actions] - 全体に関連付けるアクションボタン（任意）
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 * @throws {Error} パラメータが不正または検証に失敗した場合
 */
async function sendListTemplateMessage(botId, token, params) {
  const { userId, channelId, coverData, elements, actions, quickReply } =
    params;

  if (!userId && !channelId) {
    throw new Error("送信先が指定されていません (userId または channelId)。");
  }

  if (!elements || !Array.isArray(elements) || elements.length === 0) {
    throw new Error(
      "パラメータ 'elements' は必須で、1つ以上の項目を指定してください。"
    );
  }

  if (elements.length > 10) {
    throw new Error("リストテンプレートの項目数は最大10個までです。");
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

  if (coverData) {
    const { backgroundImageUrl, backgroundFileId } = coverData;
    if (backgroundImageUrl && backgroundFileId) {
      throw new Error(
        "カバー画像には 'backgroundImageUrl' と 'backgroundFileId' のいずれか一方を指定してください。"
      );
    }
    if (backgroundImageUrl) {
      validateImageUrl(backgroundImageUrl, "coverData.backgroundImageUrl");
    }
  }

  for (const [index, element] of elements.entries()) {
    if (!element.title) {
      throw new Error(
        `リストテンプレート項目 ${index + 1} には 'title' が必要です。`
      );
    }

    if (element.subtitle && element.subtitle.length > 1000) {
      throw new Error(
        `リストテンプレート項目 ${
          index + 1
        } の 'subtitle' は1,000文字以内で指定してください。`
      );
    }

    if (element.originalContentUrl) {
      validateImageUrl(
        element.originalContentUrl,
        `elements[${index}].originalContentUrl`
      );
    }

    if (element.defaultAction) {
      try {
        validateActionObject(
          element.defaultAction,
          `リストテンプレート項目 ${index + 1} の 'defaultAction'`,
          true
        );
      } catch (error) {
        throw new Error(
          `リストテンプレート項目 ${
            index + 1
          } の 'defaultAction' の検証に失敗しました: ${error.message}`
        );
      }
    }

    if (element.action) {
      try {
        validateAction(element.action, false);
      } catch (error) {
        throw new Error(
          `リストテンプレート項目 ${
            index + 1
          } の 'action' の検証に失敗しました: ${error.message}`
        );
      }
    }
  }

  if (actions) {
    try {
      validateAction(actions, true);
    } catch (error) {
      throw new Error(`全体アクションの検証に失敗しました: ${error.message}`);
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
      type: "list_template",
      ...(coverData && { coverData }),
      elements,
      ...(actions && { actions }),
      ...(quickReply && { quickReply }),
    },
  };

  await sendAPIMessage(token, url, payload);
}

module.exports = sendListTemplateMessage;
