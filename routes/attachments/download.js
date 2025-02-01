const express = require("express");
const axios = require("axios");
const generateJWT = require("../../middleware/generateJWT");
const fetchServerAccessToken = require("../../middleware/serverToken");
const { downloadAttachment } = require("../../services/attachment/download");

const router = express.Router();

/**
 * @route GET /attachments/:fileId
 * @description 指定された fileId のファイル・画像をダウンロードする
 *
 * 1. LINE WORKS API からダウンロードURL（リダイレクト先URL）を取得する。
 * 2. 取得したURLに対して、Authorization ヘッダー付きでGETリクエストを実施し、
 *    実際のファイルデータをストリームでクライアントに返す。
 *
 * @param {string} fileId - URLパラメータで指定
 *
 * @returns {200} 成功 - ファイルデータのストリーム
 * @returns {400} リクエストエラー - fileIdが指定されていない場合
 * @returns {401} 認証エラー - トークンが無効または期限切れ
 * @returns {500} サーバーエラー - 内部エラーが発生した場合
 */
router.get("/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!fileId) {
      return res.status(400).json({ error: "fileId が指定されていません。" });
    }

    // JWT生成およびサーバートークンの取得
    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    // fileIdからダウンロードURL（リダイレクト先URL）を取得
    const result = await downloadAttachment(serverToken, fileId);
    const downloadUrl = result.downloadUrl;
    if (!downloadUrl) {
      return res
        .status(500)
        .json({ error: "ダウンロードURLが取得できませんでした。" });
    }

    // 取得したダウンロードURLに対して、アクセストークン付きでファイルをダウンロード
    const fileResponse = await axios.get(downloadUrl, {
      responseType: "stream",
      headers: {
        authorization: `Bearer ${serverToken}`,
      },
    });

    // クライアントに返すため、必要なレスポンスヘッダーを設定
    res.setHeader("Content-Type", fileResponse.headers["content-type"]);
    res.setHeader(
      "Content-Disposition",
      fileResponse.headers["content-disposition"] ||
        `attachment; filename="${fileId}"`
    );

    // 取得したファイルストリームをクライアントへパイプ
    fileResponse.data.pipe(res);
  } catch (error) {
    console.error("ファイルダウンロードエラー:", error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
