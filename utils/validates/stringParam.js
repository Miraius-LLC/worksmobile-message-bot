/**
 * @function validateStringParam
 * @description 文字列パラメータのフォーマットを検証
 *
 * @param {string} param - 検証対象のパラメータ
 * @param {string} paramName - パラメータ名
 * @param {number} [maxLength] - 文字列の最大長（任意）
 *
 * @throws {Error} パラメータが `null` または `string` 以外の場合にエラーをスロー
 * @throws {Error} `maxLength` が指定されている場合、パラメータがその長さを超えているとエラーをスロー
 */
const validateStringParam = (param, paramName, maxLength) => {
  if (!param || typeof param !== "string") {
    throw new Error(
      `パラメータ '${paramName}' は必須で、文字列を指定してください。`
    );
  }
  if (maxLength && param.length > maxLength) {
    throw new Error(
      `パラメータ '${paramName}' は${maxLength}文字以内で指定してください。`
    );
  }
};

module.exports = validateStringParam;
