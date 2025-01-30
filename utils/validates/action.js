const validateStringParam = require("./stringParam");
const validateUrl = require("./url");

/**
 * @function validateAction
 * @description アクションオブジェクトを検証
 *
 * @param {Array|Object} actions - アクションオブジェクト、一次元配列、または二次元配列。
 * @param {boolean} isNested - `true` の場合、二次元配列を期待する（全体アクション用）。
 *
 * @throws {Error} 必須フィールドが不足している場合や不正なデータが含まれている場合にエラーをスロー。
 */
function validateAction(actions, isNested = false) {
  if (!actions) return; // actions が未定義ならば検証不要

  if (isNested) {
    // 二次元配列（全体アクション）の場合
    if (!Array.isArray(actions)) {
      throw new Error("全体アクション 'actions' は配列である必要があります。");
    }
    actions.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) {
        throw new Error(
          `全体アクション actions[${rowIndex}] は配列である必要があります。`
        );
      }
      row.forEach((action, colIndex) => {
        validateActionObject(
          action,
          `全体アクション actions[${rowIndex}][${colIndex}]`
        );
      });
    });
  } else {
    // elements[].action や column.actions の場合、配列または単一オブジェクトを許可
    if (Array.isArray(actions)) {
      actions.forEach((action, index) => {
        validateActionObject(action, `actions[${index}]`);
      });
    } else if (typeof actions === "object" && actions !== null) {
      validateActionObject(actions, "action");
    } else {
      throw new Error(
        "アクションはオブジェクトまたは配列である必要があります。"
      );
    }
  }
}

/**
 * @function validateActionObject
 * @description 単一のアクションオブジェクトを検証するヘルパー関数
 *
 * @param {Object} action - アクションオブジェクト
 * @param {string} path - エラーメッセージのパス情報（デバッグ用）
 * @param {boolean} isDefaultAction - `true` の場合、defaultAction の検証（label が不要）
 *
 * @throws {Error} 必須フィールドが不足している場合や不正なデータが含まれている場合
 */
function validateActionObject(action, path, isDefaultAction = false) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error(`${path} はオブジェクトである必要があります。`);
  }

  validateStringParam(action.type, `${path}.type`);

  // defaultAction の場合、label は不要
  if (!isDefaultAction) {
    validateStringParam(action.label, `${path}.label`);
  }

  switch (action.type) {
    case "postback":
      validateStringParam(action.postback, `${path}.postback`);
      break;
    case "message":
      // 'message' タイプは追加の必須フィールドなし
      break;
    case "uri":
      validateUrl(action.uri, `${path}.uri`);
      break;
    case "camera":
    case "cameraRoll":
    case "location":
      // これらのタイプには追加フィールドは不要
      break;
    case "copy":
      validateStringParam(action.copyText, `${path}.copyText`);
      break;
    default:
      throw new Error(
        `${path}.type に不正な値が含まれています: ${action.type}`
      );
  }
}

module.exports = { validateAction, validateActionObject };
