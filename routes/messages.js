const getServerToken = require('../middleware/auth')

const BOT_ID = process.env.BOT_ID

const services = {
  text: require('../services/message/text'),
  sticker: require('../services/message/sticker'),
  image: require('../services/message/image'),
  file: require('../services/message/file'),
  link: require('../services/message/link'),
  button_template: require('../services/message/buttonTemplate'),
  list_template: require('../services/message/listTemplate'),
  carousel: require('../services/message/carousel'),
  image_carousel: require('../services/message/imageCarousel'),
  flex: require('../services/message/flex'),
}

function createHandler(base, type) {
  const service = services[type]
  return async (request, reply) => {
    try {
      const targetKey = base === 'channels' ? 'channelId' : 'userId'
      const serverToken = await getServerToken()

      await service(BOT_ID, serverToken, {
        [targetKey]: request.params.id,
        ...request.body,
      })

      reply.code(200).send()
    } catch (error) {
      reply.code(500).send({ error: error.message })
    }
  }
}

module.exports = createHandler
