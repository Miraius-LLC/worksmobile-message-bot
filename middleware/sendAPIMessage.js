const axios = require("axios");

/**
 * 指定されたURLにAPIメッセージを送信する関数。
 *
 * @param {string} token - Bearer認証に使用するトークン。
 * @param {string} url - メッセージを送信するAPIエンドポイントのURL。
 * @param {Object} data - 送信するメッセージデータ（JSON形式）。
 * @returns {Promise<void>} 成功時には何も返さず、エラー発生時には例外をスローします。
 * @throws {Error} リクエストが失敗した場合、エラーメッセージと共に例外をスローします。
 */
async function sendAPIMessage(token, url, data) {
  // ヘッダーの設定
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    // POSTリクエストを送信
    const response = await axios.post(url, data, { headers });
    console.log(`メッセージが正常に送信されました: ${response.data}`);
  } catch (error) {
    // エラー処理
    if (error.response) {
      console.error(
        `メッセージ送信中にエラーが発生しました (ステータスコード: ${error.response.status}):`,
        error.response.data
      );
    } else {
      console.error(`メッセージ送信中にエラーが発生しました: ${error.message}`);
    }
    // エラーを再スロー
    throw error;
  }
}

module.exports = sendAPIMessage;
