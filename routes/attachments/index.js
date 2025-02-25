const fp = require('fastify-plugin')

/**
 * 添付ファイル関連のルートを管理するプラグイン
 */
async function attachmentsPlugin(fastify, options) {
  fastify.register(
    async function attachmentsRouter(fastify) {
      // アップロード処理
      await fastify.register(require('./upload'))

      // ダウンロード処理
      await fastify.register(require('./download'))

      // 添付ファイル専用の404エラーハンドラー
      fastify.setNotFoundHandler((request, reply) => {
        reply.code(404).send({
          error: 'Attachment Not Found',
          message: `添付ファイル ${request.url} が見つかりません`,
          path: request.url,
          timestamp: new Date().toISOString(),
          statusCode: 404,
        })
      })
    },
    { prefix: '/attachments' },
  )
}

module.exports = fp(attachmentsPlugin)
