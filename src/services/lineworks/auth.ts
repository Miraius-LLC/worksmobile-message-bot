import jwt from 'jsonwebtoken'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/auth'

const AUTH_URL = 'https://auth.worksmobile.com/oauth2/v2.0/token'

function generateJWT(): string {
  const cfg = config()
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = {
    iss: cfg.clientId,
    sub: cfg.serviceAccount,
    aud: AUTH_URL,
    iat: issuedAt,
    exp: issuedAt + 60 * 60,
  }
  return jwt.sign(payload, cfg.privateKey, { algorithm: 'RS256' })
}

async function fetchAccessToken(jwtToken: string): Promise<string> {
  const cfg = config()
  const params = new URLSearchParams({
    assertion: jwtToken,
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'bot',
  })

  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    logger.error('アクセストークンの取得に失敗', {
      caller: `${CALLER}.fetchAccessToken`,
      status: response.status,
      debug: body,
    })
    throw new Error(`サーバーアクセストークンの取得に失敗しました (status=${response.status})`)
  }

  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error('アクセストークンがレスポンスに含まれていません。')
  }
  return data.access_token
}

export async function getServerToken(): Promise<string> {
  const jwtToken = generateJWT()
  return fetchAccessToken(jwtToken)
}
