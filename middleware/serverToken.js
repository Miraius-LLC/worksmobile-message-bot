// OAuth認証用のエンドポイントURL
const AUTH_URL = "https://auth.worksmobile.com/oauth2/v2.0/token";

// 環境変数
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const axios = require("axios");

/**
 * サーバーアクセストークンを取得する関数。
 *
 * JWTトークンを使用して認証サーバーにリクエストを送り、アクセストークンを取得します。
 *
 * @param {string} jwtToken - 認証に使用するJWTトークン。
 * @returns {Promise<string>} アクセストークンを返すPromise。
 * @throws {Error} トークンが見つからない場合、またはリクエストが失敗した場合にエラーをスロー。
 */
async function fetchServerAccessToken(jwtToken) {
  if (!jwtToken) {
    throw new Error("JWTトークンが指定されていません。");
  }

  // リクエストパラメータを設定
  const params = new URLSearchParams({
    assertion: jwtToken,
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "bot",
  });

  try {
    // 認証リクエストを送信
    const response = await axios.post(AUTH_URL, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // レスポンスからアクセストークンを取得
    if (!response.data?.access_token) {
      throw new Error("アクセストークンがレスポンスに含まれていません。");
    }

    return response.data.access_token;
  } catch (error) {
    // エラー発生時に詳細な情報をスロー
    throw new Error(
      `サーバーアクセストークンの取得に失敗しました: ${error.message}`
    );
  }
}

module.exports = fetchServerAccessToken;
