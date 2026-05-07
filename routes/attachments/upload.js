const fp = require('fastify-plugin')
const multer = require('fastify-multer')
const path = require('node:path')
const getServerToken = require('../../middleware/auth')
const { uploadAttachment } = require('../../services/attachment/upload')

// アップロード用の一時ディレクトリ設定
const uploadDir = path.join(__dirname, '../../uploads')
const upload = multer({ dest: uploadDir })

async function uploadPlugin(fastify, opts) {
  fastify.post(
    '/',
    {
      preHandler: upload.single('file'),
    },
    async (request, reply) => {
      try {
        if (!request.file) {
          return reply.code(400).send({
            error: 'ファイルがアップロードされていません。',
          })
        }

        const { path: filePath, originalname: fileName, mimetype: fileType } = request.file
        const serverToken = await getServerToken()
        const result = await uploadAttachment(serverToken, filePath, fileName, fileType)

        return result
      } catch (error) {
        request.log.error('ファイルアップロードエラー:', error)
        return reply.code(500).send({ error: error.message })
      }
    },
  )
}

module.exports = fp(uploadPlugin)
