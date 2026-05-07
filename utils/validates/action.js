const validateStringParam = require('./stringParam')
const validateUrl = require('./url')

function validateAction(actions, isNested = false) {
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
  } else {
    if (Array.isArray(actions)) {
      for (const [index, action] of actions.entries()) {
        validateActionObject(action, `actions[${index}]`)
      }
    } else if (typeof actions === 'object' && actions !== null) {
      validateActionObject(actions, 'action')
    } else {
      throw new Error('アクションはオブジェクトまたは配列である必要があります。')
    }
  }
}

function validateActionObject(action, path, isDefaultAction = false) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new Error(`${path} はオブジェクトである必要があります。`)
  }

  validateStringParam(action.type, `${path}.type`)

  if (!isDefaultAction) {
    validateStringParam(action.label, `${path}.label`)
  }

  switch (action.type) {
    case 'postback':
      validateStringParam(action.postback, `${path}.postback`)
      break
    case 'message':
      break
    case 'uri':
      validateUrl(action.uri, `${path}.uri`)
      break
    case 'camera':
    case 'cameraRoll':
    case 'location':
      break
    case 'copy':
      validateStringParam(action.copyText, `${path}.copyText`)
      break
    default:
      throw new Error(`${path}.type に不正な値が含まれています: ${action.type}`)
  }
}

module.exports = { validateAction, validateActionObject }
