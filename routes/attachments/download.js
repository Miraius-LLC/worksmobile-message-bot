const fp = require("fastify-plugin");
const fs = require("node:fs");
const path = require("node:path");

module.exports = fp(async (fastify, opts) => {
	// ファイルダウンロードルート
	fastify.get("/:filename", async (request, reply) => {
		try {
			const { filename } = request.params;
			const filePath = path.join(__dirname, "../../uploads", filename);

			// ファイルの存在確認
			if (!fs.existsSync(filePath)) {
				return reply.status(404).send({ error: "ファイルが見つかりません" });
			}

			// ファイルを送信
			return reply.sendFile(filename, path.join(__dirname, "../../uploads"));
		} catch (error) {
			return reply
				.status(500)
				.send({ error: `ダウンロード処理エラー: ${error.message}` });
		}
	});
});
