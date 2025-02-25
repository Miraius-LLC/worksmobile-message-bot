const fp = require("fastify-plugin");
const multer = require("fastify-multer");
const upload = multer({ dest: "uploads/" });

module.exports = fp(async (fastify, opts) => {
	// マルチパートフォームデータ処理のセットアップ
	fastify.register(multer.contentParser);

	// ファイルアップロードルート
	fastify.post(
		"/upload",
		{ preHandler: upload.single("file") },
		async (request, reply) => {
			try {
				const file = request.file;
				if (!file) {
					return reply
						.status(400)
						.send({ error: "ファイルがアップロードされていません" });
				}

				// ファイル情報を返す
				return reply.send({
					filename: file.originalname,
					mimetype: file.mimetype,
					size: file.size,
					path: file.path,
				});
			} catch (error) {
				return reply
					.status(500)
					.send({ error: `アップロード処理エラー: ${error.message}` });
			}
		},
	);
});
