import { validateStringParam } from './stringParam'
import { validateUrl } from './url'

export function validateActionObject(action: unknown, path: string, isDefaultAction = false): void {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new Error(`${path} はオブジェクトである必要があります。`)
  }

  const obj = action as Record<string, unknown>
  validateStringParam(obj.type, `${path}.type`)

  if (!isDefaultAction) {
    validateStringParam(obj.label, `${path}.label`)
  }

  switch (obj.type) {
    case 'postback':
      validateStringParam(obj.postback, `${path}.postback`)
      break
    case 'message':
      break
    case 'uri':
      validateUrl(obj.uri, `${path}.uri`)
      break
    case 'camera':
    case 'cameraRoll':
    case 'location':
      break
    case 'copy':
      validateStringParam(obj.copyText, `${path}.copyText`)
      break
    default:
      throw new Error(`${path}.type に不正な値が含まれています: ${String(obj.type)}`)
  }
}

/**
 * 単一アクション・配列・ネスト配列のいずれにも対応する。
 * `isNested = true` は list_template の全体 actions (2 次元配列) 用。
 */
export function validateAction(actions: unknown, isNested = false): void {
  if (!actions) return

  if (isNested) {
    if (!Array.isArray(actions)) {
      throw new Error("全体アクション 'actions' は配列である必要があります。")
    }
    for (const [rowIndex, row] of actions.entries()) {
      if (!Array.isArray(row)) {
        throw new Error(`全体アクション actions[${rowIndex}] は配列である必要があります。`)
      }
      for (const [colIndex, action] of row.entries()) {
        validateActionObject(action, `全体アクション actions[${rowIndex}][${colIndex}]`)
      }
    }
    return
  }

  if (Array.isArray(actions)) {
    for (const [index, action] of actions.entries()) {
      validateActionObject(action, `actions[${index}]`)
    }
    return
  }

  if (typeof actions === 'object' && actions !== null) {
    validateActionObject(actions, 'action')
    return
  }

  throw new Error('アクションはオブジェクトまたは配列である必要があります。')
}
