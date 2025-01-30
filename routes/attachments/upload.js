const express = require("express");
const generateJWT = require("../../middleware/generateJWT");
const fetchServerAccessToken = require("../../middleware/serverToken");
const {
  uploadAttachment,
  upload,
} = require("../../services/attachment/upload");

const router = express.Router();

/**
 * @route POST /attachments
 * @description LINE WORKS にファイルをアップロード
 *
 * @param {file} file - アップロードするファイル（multipart/form-data）。
 *
 * @returns {200} 成功 - LINE WORKS API のレスポンスをそのまま返す。
 * @returns {400} リクエストエラー - 必須パラメータが不足している場合。
 * @returns {401} 認証エラー - トークンが無効または期限切れ。
 * @returns {500} サーバーエラー - サーバー内部でエラーが発生しました。
 */
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "ファイルがアップロードされていません。" });
    }

    const {
      path: filePath,
      originalname: fileName,
      mimetype: fileType,
    } = req.file;

    const jwtToken = await generateJWT();
    const serverToken = await fetchServerAccessToken(jwtToken);

    const result = await uploadAttachment(
      serverToken,
      filePath,
      fileName,
      fileType
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("ファイルアップロードエラー:", error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
