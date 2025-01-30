const validateUrl = require("./url");

/**
 * @function validateImageUrl
 * @description 画像URLのフォーマットと長さを検証（HTTPS のみ許可、特定の拡張子のみ許可）
 *
 * @param {string} url - 検証対象のURL
 * @param {string} paramName - パラメータ名
 *
 * @throws {Error} URLがHTTPS以外、または長さが1000文字を超える場合
 * @throws {Error} 許可された拡張子以外の場合にエラーをスロー
 */
const validateImageUrl = (url, paramName) => {
  validateUrl(url, paramName, 1000); // 最大1000文字でHTTP/HTTPS許可

  if (!/^https:\/\//i.test(url)) {
    throw new Error(
      `パラメータ '${paramName}' は HTTPS のURLを指定してください。`
    );
  }

  // 許可される画像拡張子
  const allowedExtensions = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "svg",
    "bmp",
    "webp",
    "tif",
    "tiff",
    "ico",
    "icns",
    "psd",
    "ai",
    "clip",
    "heic",
    "rw2",
  ];

  // URLから拡張子を取得（拡張子がない場合は許可）
  const urlPath = new URL(url).pathname;
  const extMatch = urlPath.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch) {
    const ext = extMatch[1].toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new Error(
        `パラメータ '${paramName}' の拡張子 '${ext}' は許可されていません。`
      );
    }
  }
};

module.exports = validateImageUrl;
