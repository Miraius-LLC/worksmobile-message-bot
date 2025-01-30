// 環境変数
const CLIENT_ID = process.env.CLIENT_ID;
const SERVICE_ACCOUNT = process.env.SERVICE_ACCOUNT;
const PRIVATE_KEY = process.env.PRIVATE_KEY
  ? Buffer.from(process.env.PRIVATE_KEY, "base64").toString("utf-8")
  : null; // Base64デコード

if (!PRIVATE_KEY) {
  throw new Error(
    "PRIVATE_KEYが設定されていません。環境変数を確認してください。"
  );
}

const jwt = require("jsonwebtoken");

/**
 * JWTトークンを生成する関数。
 *
 * クライアントID、サービスアカウント、プライベートキーを使用してJWTを生成します。
 *
 * @returns {Promise<string>} 生成されたJWTトークンを返します。
 * @throws {Error} JWTトークン生成中にエラーが発生した場合。
 */
async function generateJWT() {
  try {
    const issuedAt = Math.floor(Date.now() / 1000); // 現在時刻（秒）
    const expirationTime = issuedAt + 60 * 60; // 有効期間は1時間

    const payload = {
      iss: CLIENT_ID, // 発行者
      sub: SERVICE_ACCOUNT, // サービスアカウント
      aud: "https://auth.worksmobile.com/oauth2/v2.0/token", // トークンを発行する対象
      iat: issuedAt, // 発行時刻
      exp: expirationTime, // 有効期限
    };

    // JWTトークン生成
    return jwt.sign(payload, PRIVATE_KEY, { algorithm: "RS256" });
  } catch (error) {
    console.error("JWTトークンの生成中にエラーが発生しました:", error.message);
    throw error;
  }
}

module.exports = generateJWT;
