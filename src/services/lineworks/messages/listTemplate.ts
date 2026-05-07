import type { MessageSender } from '@/types/lineworks'
import {
  validateAction,
  validateActionObject,
  validateImageUrl,
  validateStringParam,
} from '@/utils/validates'
import { sendMessage } from './_send'

type ListElement = {
  title?: unknown
  subtitle?: unknown
  originalContentUrl?: unknown
  defaultAction?: unknown
  action?: unknown
}

type CoverData = {
  backgroundImageUrl?: unknown
  backgroundFileId?: unknown
}

export const sendListTemplateMessage: MessageSender = async (botId, token, params) => {
  const { coverData, elements, actions } = params as {
    coverData?: CoverData
    elements?: ListElement[]
    actions?: unknown
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

  for (const [index, element] of elements.entries()) {
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
          `リストテンプレート項目 ${index + 1} の 'defaultAction' の検証に失敗しました: ${(error as Error).message}`,
        )
      }
    }
    if (element.action) {
      try {
        validateAction(element.action, false)
      } catch (error) {
        throw new Error(
          `リストテンプレート項目 ${index + 1} の 'action' の検証に失敗しました: ${(error as Error).message}`,
        )
      }
    }
  }

  if (actions) {
    try {
      validateAction(actions, true)
    } catch (error) {
      throw new Error(`全体アクションの検証に失敗しました: ${(error as Error).message}`)
    }
  }

  await sendMessage(botId, token, params, {
    type: 'list_template',
    ...(coverData ? { coverData } : {}),
    elements,
    ...(actions ? { actions } : {}),
  })
}
