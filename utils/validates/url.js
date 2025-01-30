const validateStringParam = require("./stringParam");

/**
 * @function validateUrl
 * @description URL のフォーマットを厳格に検証する（HTTP および HTTPS 許可）
 *
 * @param {string} url - 検証対象の URL
 * @param {string} paramName - パラメータ名（エラーメッセージ用）
 * @param {number} [maxLength] - URL の最大長（任意）
 *
 * @throws {Error} URL が `null` または `string` 以外の場合にエラーをスロー
 * @throws {Error} `maxLength` が指定されている場合、URL がその長さを超えているとエラーをスロー
 * @throws {Error} URL が `HTTP` または `HTTPS` 形式でない場合にエラーをスロー
 */
const validateUrl = (url, paramName, maxLength) => {
  validateStringParam(url, paramName, maxLength);

  const httpRegex = /^(https?:\/\/)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/\S*)?$/;
  if (!httpRegex.test(url)) {
    throw new Error(
      `パラメータ '${paramName}' は HTTP または HTTPS の正しい URL を指定してください。`
    );
  }
};

module.exports = validateUrl;
