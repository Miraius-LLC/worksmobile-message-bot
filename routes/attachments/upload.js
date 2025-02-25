const fp = require('fastify-plugin')
const multer = require('fastify-multer')
const path = require('node:path')
const generateJWT = require('../../middleware/generateJWT')
const fetchServerAccessToken = require('../../middleware/serverToken')
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

        // LINE WORKS認証処理
        const jwtToken = await generateJWT()
        const serverToken = await fetchServerAccessToken(jwtToken)

        // LINE WORKSへのアップロード
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
