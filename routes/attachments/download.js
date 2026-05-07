const fp = require('fastify-plugin')
const axios = require('axios')
const getServerToken = require('../../middleware/auth')
const { downloadAttachment } = require('../../services/attachment/download')

async function downloadPlugin(fastify, opts) {
  fastify.get('/:fileId', async (request, reply) => {
    try {
      const { fileId } = request.params
      if (!fileId) {
        return reply.code(400).send({ error: 'fileId が指定されていません。' })
      }

      const serverToken = await getServerToken()
      const result = await downloadAttachment(serverToken, fileId)
      const downloadUrl = result.downloadUrl
      if (!downloadUrl) {
        return reply.code(500).send({ error: 'ダウンロードURLが取得できませんでした。' })
      }

      const fileResponse = await axios.get(downloadUrl, {
        responseType: 'stream',
        headers: {
          authorization: `Bearer ${serverToken}`,
        },
      })

      reply
        .headers(fileResponse.headers)
        .header(
          'Content-Disposition',
          fileResponse.headers['content-disposition'] || `attachment; filename="${fileId}"`,
        )

      return reply.send(fileResponse.data)
    } catch (error) {
      request.log.error('ファイルダウンロードエラー:', error)
      return reply.code(500).send({ error: error.message })
    }
  })
}

module.exports = fp(downloadPlugin)
