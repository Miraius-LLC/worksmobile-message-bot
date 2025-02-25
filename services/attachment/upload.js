const axios = require("axios");
const FormData = require("form-data");
const fs = require("node:fs");
const multer = require("multer");

// `uploads/` ディレクトリが存在しない場合は作成
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

// Multer 設定（ファイルを一時保存）
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

/**
 * ファイルを LINE WORKS にアップロードする
 * @param {string} token - APIトークン
 * @param {string} filePath - アップロードするファイルのパス
 * @param {string} fileName - ファイル名
 * @param {string} fileType - ファイルのMIMEタイプ
 * @throws {Error} アップロードに失敗した場合
 * @returns {Object} アップロード成功時のレスポンス（fileId）
 */
async function uploadAttachment(token, filePath, fileName, fileType) {
  try {
    const botId = process.env.BOT_ID;
    const attachmentsUrl = `https://www.worksapis.com/v1.0/bots/${botId}/attachments`;

    // `fileName` を送信して `uploadUrl` を取得
    const uploadResponse = await axios.post(
      attachmentsUrl,
      { fileName },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { uploadUrl, fileId } = uploadResponse.data;

    // `uploadUrl` に対してファイルをアップロード
    const fileStream = fs.createReadStream(filePath);
    const formData = new FormData();
    formData.append("resourceName", fileName);
    formData.append("file", fileStream, {
      filename: fileName,
      contentType: fileType,
    });

    await axios.post(uploadUrl, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...formData.getHeaders(),
      },
    });

    return { fileId };
  } catch (error) {
    console.error(
      "ファイルアップロードエラー:",
      error.response?.data || error.message
    );
    throw new Error(`ファイルのアップロードに失敗しました: ${error.message}`);
  } finally {
    // エラーが発生しても確実にファイルを削除する
    fs.unlink(filePath, (err) => {
      if (err) console.error("Failed to delete file:", filePath, err);
    });
  }
}

module.exports = { uploadAttachment, upload };
