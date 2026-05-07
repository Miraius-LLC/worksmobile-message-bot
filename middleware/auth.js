const generateJWT = require('./generateJWT')
const fetchServerAccessToken = require('./serverToken')

async function getServerToken() {
  const jwtToken = await generateJWT()
  return fetchServerAccessToken(jwtToken)
}

module.exports = getServerToken
