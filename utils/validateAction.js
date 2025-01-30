/**
 * アクションオブジェクトを検証します。
 *
 * @param {Array|Object} actions - アクションオブジェクト、一次元配列、または二次元配列。
 * @param {boolean} isNested - `true` の場合、二次元配列を期待する（全体アクション用）。
 * @throws {Error} 必須フィールドが不足している場合や不正なデータが含まれている場合にエラーをスローします。
 */
function validateAction(actions, isNested = false) {
  if (!actions) return; // actions が未定義ならば検証不要

  if (isNested) {
    // 二次元配列（全体アクション）の場合
    if (!Array.isArray(actions)) {
      throw new Error("全体アクション 'actions' は配列である必要があります。");
    }
    for (const [rowIndex, row] of actions.entries()) {
      if (!Array.isArray(row)) {
        throw new Error(
          `全体アクション actions[${rowIndex}] は配列である必要があります。`
        );
      }
      for (const [colIndex, action] of row.entries()) {
        validateActionObject(
          action,
          `全体アクション actions[${rowIndex}][${colIndex}]`
        );
      }
    }
  } else {
    // elements[].action や column.actions の場合、配列または単一オブジェクトを許可
    if (Array.isArray(actions)) {
      // actions が配列の場合、すべての要素を検証
      actions.forEach((action, index) => {
        validateActionObject(action, `actions[${index}]`);
      });
    } else if (typeof actions === "object" && actions !== null) {
      // 単一のオブジェクトの場合
      validateActionObject(actions, "action");
    } else {
      throw new Error(
        "アクションはオブジェクトまたは配列である必要があります。"
      );
    }
  }
}

/**
 * 単一のアクションオブジェクトを検証するヘルパー関数
 *
 * @param {Object} action - アクションオブジェクト。
 * @param {string} path - エラーメッセージのパス情報（デバッグ用）。
 * @param {boolean} isDefaultAction - `true` の場合、defaultAction の検証（label が不要）
 * @throws {Error} 必須フィールドが不足している場合や不正なデータが含まれている場合にエラーをスローします。
 */
function validateActionObject(action, path, isDefaultAction = false) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error(`${path} はオブジェクトである必要があります。`);
  }

  if (!action.type) {
    throw new Error(`${path} のアクションオブジェクトには 'type' が必要です。`);
  }

  // defaultAction の場合、label は不要
  if (!isDefaultAction && !action.label) {
    throw new Error(
      `${path} のアクションオブジェクトには 'label' が必要です。`
    );
  }

  switch (action.type) {
    case "postback":
      if (!action.postback) {
        throw new Error(
          `${path} の 'postback' タイプのアクションには 'postback' フィールドが必要です。`
        );
      }
      break;
    case "message":
      // 'message' タイプは追加の必須フィールドなし
      break;
    case "uri":
      if (!action.uri || !/^https?:\/\//.test(action.uri)) {
        throw new Error(
          `${path} の 'uri' タイプのアクションには 'uri' フィールドが必要です (HTTP または HTTPS のみ)。`
        );
      }
      break;
    case "camera":
    case "cameraRoll":
    case "location":
      // これらのタイプには追加フィールドは不要。
      break;
    case "copy":
      if (!action.copyText) {
        throw new Error(
          `${path} の 'copy' タイプのアクションには 'copyText' フィールドが必要です。`
        );
      }
      break;
    default:
      throw new Error(
        `${path} の 'type' に不正な値が含まれています: ${action.type}`
      );
  }
}

// validateActionObject をエクスポート
module.exports = { validateAction, validateActionObject };
