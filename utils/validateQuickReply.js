const { validateAction, validateActionObject } = require("./validateAction");

/**
 * クイックリプライオブジェクトを検証します。
 *
 * @param {Object} quickReply - クイックリプライオブジェクト。
 * @throws {Error} 必須フィールドが不足している場合や不正なデータが含まれている場合にエラーをスローします。
 */
function validateQuickReply(quickReply) {
  if (!quickReply || typeof quickReply !== "object") {
    throw new Error("クイックリプライはオブジェクトである必要があります。");
  }

  if (!Array.isArray(quickReply.items) || quickReply.items.length === 0) {
    throw new Error(
      "クイックリプライには 'items' 配列が必要で、少なくとも1つの項目が必要です。"
    );
  }

  // 各クイックリプライ項目を検証
  quickReply.items.forEach((item, index) => {
    if (!item.action) {
      throw new Error(
        `クイックリプライ項目 ${index + 1} には 'action' が必要です。`
      );
    }

    if (item.imageUrl) {
      if (
        typeof item.imageUrl !== "string" ||
        !/^https:\/\//.test(item.imageUrl)
      ) {
        throw new Error(
          `クイックリプライ項目 ${
            index + 1
          } の 'imageUrl' は HTTPS の URL を指定してください。`
        );
      }
    }

    // アクションオブジェクトの検証
    try {
      validateAction(item.action, false);
    } catch (error) {
      throw new Error(
        `クイックリプライ項目 ${index + 1} のアクションが無効です: ${
          error.message
        }`
      );
    }
  });
}

module.exports = validateQuickReply;
