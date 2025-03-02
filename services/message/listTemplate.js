const sendAPIMessage = require('../../middleware/sendAPIMessage')
const {
  validateAction,
  validateActionObject,
  validateQuickReply,
  validateStringParam,
  validateImageUrl,
} = require('../../utils/validates')

/**
 * @function sendListTemplateMessage
 * @description リストテンプレートメッセージを送信する共通ロジック
 *
 * @param {string} botId - Bot ID
 * @param {string} token - APIトークン
 * @param {Object} params - 送信対象情報
 * @param {string} [params.userId] - ユーザーID（`channelId` の代わりに指定可能）
 * @param {string} [params.channelId] - チャンネルID（`userId` の代わりに指定可能）
 * @param {Object} [params.coverData] - カバー画像データ（任意）
 * @param {Array} params.elements - リスト項目の配列（必須、最大10個）
 * @param {Array} [params.actions] - 全体に関連付けるアクションボタン（任意）
 * @param {Object} [params.quickReply] - クイックリプライオブジェクト（任意）
 *
 * @throws {Error} 送信先が指定されていない場合 (`userId` または `channelId` が必要)
 * @throws {Error} `elements` が指定されていない、または 1 つ以上の項目が必要
 * @throws {Error} `elements` の配列長が 10 を超える場合
 * @throws {Error} `coverData` の `backgroundImageUrl` または `backgroundFileId` の指定が無効な場合
 * @throws {Error} `elements` の `title` または `subtitle` のフォーマットが無効な場合
 * @throws {Error} `elements` の `originalContentUrl` のフォーマットが無効な場合（HTTPSのみ）
 * @throws {Error} `defaultAction` または `action` のフォーマットが無効な場合
 * @throws {Error} `quickReply` のフォーマットが無効な場合
 *
 * @returns {Promise<void>} API メッセージ送信を実行し、完了時に `void` を返す
 */
async function sendListTemplateMessage(botId, token, params) {
  const { userId, channelId, coverData, elements, actions, quickReply } = params

  if (!(userId || channelId)) {
    throw new Error('送信先が指定されていません (userId または channelId)。')
  }

  if (!Array.isArray(elements) || elements.length === 0) {
    throw new Error("パラメータ 'elements' は必須で、1つ以上の項目を指定してください。")
  }
  if (elements.length > 10) {
    throw new Error('リストテンプレートの項目数は最大10個までです。')
  }

  if (coverData) {
    const { backgroundImageUrl, backgroundFileId } = coverData
    if (backgroundImageUrl && backgroundFileId) {
      throw new Error(
        "カバー画像には 'backgroundImageUrl' と 'backgroundFileId' のいずれか一方を指定してください。",
      )
    }
    if (backgroundImageUrl) {
      validateImageUrl(backgroundImageUrl, 'coverData.backgroundImageUrl')
    }
  }

  elements.forEach((element, index) => {
    validateStringParam(element.title, `elements[${index}].title`)
    if (element.subtitle) {
      validateStringParam(element.subtitle, `elements[${index}].subtitle`, 1000)
    }
    if (element.originalContentUrl) {
      validateImageUrl(element.originalContentUrl, `elements[${index}].originalContentUrl`)
    }
    if (element.defaultAction) {
      try {
        validateActionObject(element.defaultAction, `elements[${index}].defaultAction`, true)
      } catch (error) {
        throw new Error(
          `リストテンプレート項目 ${
            index + 1
          } の 'defaultAction' の検証に失敗しました: ${error.message}`,
        )
      }
    }
    if (element.action) {
      try {
        validateAction(element.action, false)
      } catch (error) {
        throw new Error(
          `リストテンプレート項目 ${index + 1} の 'action' の検証に失敗しました: ${error.message}`,
        )
      }
    }
  })

  if (actions) {
    try {
      validateAction(actions, true)
    } catch (error) {
      throw new Error(`全体アクションの検証に失敗しました: ${error.message}`)
    }
  }

  if (quickReply) {
    if (typeof quickReply !== 'object') {
      throw new Error("パラメータ 'quickReply' はオブジェクト形式で指定してください。")
    }
    try {
      validateQuickReply(quickReply)
    } catch (error) {
      throw new Error(`クイックリプライの検証に失敗しました: ${error.message}`)
    }
  }

  const target = userId ? `users/${userId}/messages` : `channels/${channelId}/messages`
  const url = `https://www.worksapis.com/v1.0/bots/${botId}/${target}`

  const payload = {
    content: {
      type: 'list_template',
      ...(coverData && { coverData }),
      elements,
      ...(actions && { actions }),
      ...(quickReply && { quickReply }),
    },
  }

  await sendAPIMessage(token, url, payload)
}

module.exports = sendListTemplateMessage
