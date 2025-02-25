const fp = require('fastify-plugin')
const axios = require('axios')
const generateJWT = require('../../middleware/generateJWT')
const fetchServerAccessToken = require('../../middleware/serverToken')
const { downloadAttachment } = require('../../services/attachment/download')

/**
 * @route GET /attachments/:fileId
 * @description 指定された fileId のファイル・画像をダウンロードする
 */
async function downloadPlugin(fastify, opts) {
  fastify.get('/:fileId', async (request, reply) => {
    try {
      const { fileId } = request.params
      if (!fileId) {
        return reply.code(400).send({ error: 'fileId が指定されていません。' })
      }

      // JWT生成およびサーバートークンの取得
      const jwtToken = await generateJWT()
      const serverToken = await fetchServerAccessToken(jwtToken)

      // fileIdからダウンロードURL（リダイレクト先URL）を取得
      const result = await downloadAttachment(serverToken, fileId)
      const downloadUrl = result.downloadUrl
      if (!downloadUrl) {
        return reply.code(500).send({ error: 'ダウンロードURLが取得できませんでした。' })
      }

      // 取得したダウンロードURLに対して、アクセストークン付きでファイルをダウンロード
      const fileResponse = await axios.get(downloadUrl, {
        responseType: 'stream',
        headers: {
          authorization: `Bearer ${serverToken}`,
        },
      })

      // レスポンスヘッダーの設定
      reply
        .headers(fileResponse.headers)
        .header(
          'Content-Disposition',
          fileResponse.headers['content-disposition'] || `attachment; filename="${fileId}"`,
        )

      // ストリームをレスポンスに流す
      return reply.send(fileResponse.data)
    } catch (error) {
      request.log.error('ファイルダウンロードエラー:', error)
      return reply.code(500).send({ error: error.message })
    }
  })
}

module.exports = fp(downloadPlugin)
