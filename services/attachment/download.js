const axios = require("axios");

/**
 * fileIdからダウンロードURLを取得する
 *
 * LINE WORKS のダウンロードエンドポイントでは、アクセストークンは
 * HTTP ヘッダーの "authorization" にて渡す必要があります。
 * サーバー側でリダイレクトが発生するため、axios の自動リダイレクトを無効化し
 * リダイレクトレスポンス（3xx）の Location ヘッダーから実際のダウンロード URL を取得します。
 *
 * @param {string} token - APIトークン
 * @param {string} fileId - ダウンロード対象のファイルID
 * @throws {Error} URL取得に失敗した場合
 * @returns {Object} ダウンロード成功時のレスポンス（例: { downloadUrl: "https://～" }）
 */
async function downloadAttachment(token, fileId) {
  try {
    const botId = process.env.BOT_ID;
    const downloadEndpoint = `https://www.worksapis.com/v1.0/bots/${botId}/attachments/${fileId}`;

    const response = await axios.get(downloadEndpoint, {
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      },
      // 自動リダイレクトを無効化（リダイレクト先へはヘッダーが付与されないため）
      maxRedirects: 0,
      // 3xx のレスポンスも正常として扱う
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // 3xx の場合、Location ヘッダーに実際のダウンロード URL が設定される
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.location
    ) {
      return { downloadUrl: response.headers.location };
    }

    return response.data;
  } catch (error) {
    console.error(
      "ファイルダウンロードURL取得エラー:",
      error.response?.data || error.message
    );
    throw new Error(`ダウンロードURLの取得に失敗しました: ${error.message}`);
  }
}

module.exports = { downloadAttachment };
