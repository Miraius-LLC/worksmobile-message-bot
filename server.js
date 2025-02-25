const fastify = require('fastify')
const multipart = require('@fastify/multipart')
const basicAuth = require('@fastify/basic-auth')
// 環境設定
const PORT = process.env.PORT || 8080
const isProduction = process.env.NODE_ENV === 'production'
const useHttp2 = isProduction // 本番環境のみ HTTP/2 を有効化

// Fastifyインスタンス生成（本番環境のみHTTP/2有効）
const app = fastify({
  http2: useHttp2,
  logger: !isProduction, // 開発環境のみロガーを有効化
})

// Multipart support
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

// ヘルスチェックエンドポイント
app.get('/health', async (request, reply) => {
  return reply.code(200).send({ status: 'ok' })
})

// ルートエンドポイント
app.get('/', (req, reply) => reply.send('Hello World.'))

// 動的ルート登録
const messageTypes = [
  'text',
  'sticker',
  'image',
  'file',
  'link',
  'button_template',
  'list_template',
  'carousel',
  'image_carousel',
  'flex',
]

// メッセージルート登録
for (const base of ['channels', 'users']) {
  for (const type of messageTypes) {
    app.post(`/${base}/:id/messages/type/${type}`, async (request, reply) => {
      try {
        const handler = require(`./routes/${base}/messages/${type}`)
        await handler(request.params.id)(request, reply)
      } catch (error) {
        reply.status(500).send({ error: `ルート処理エラー: ${error.message}` })
      }
    })
  }
}

// アップロード・ダウンロード
app.register(require('./routes/attachments'))

// 404ハンドリング
app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({ error: 'Not Found', path: request.url })
})

// エラーハンドラー
app.setErrorHandler((error, request, reply) => {
  reply.status(500).send({ error: error.message })
})

// サーバー起動
const start = async () => {
  try {
    await app.ready() // プラグインのロードを待機
    app.log.info(`Starting server... (HTTP/${useHttp2 ? '2' : '1.1'})`)
    await app.listen({ port: PORT, host: '0.0.0.0' })
    app.log.info(`Server running on port ${PORT} (NODE_ENV=${process.env.NODE_ENV})`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
