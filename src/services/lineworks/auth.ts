import jwt from 'jsonwebtoken'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/auth'

const AUTH_URL = 'https://auth.worksmobile.com/oauth2/v2.0/token'

function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`環境変数 '${name}' が設定されていません。`)
  }
  return value
}

function getPrivateKey(): string {
  const raw = getEnv('PRIVATE_KEY')
  return Buffer.from(raw, 'base64').toString('utf-8')
}

function generateJWT(): string {
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = {
    iss: getEnv('CLIENT_ID'),
    sub: getEnv('SERVICE_ACCOUNT'),
    aud: AUTH_URL,
    iat: issuedAt,
    exp: issuedAt + 60 * 60,
  }
  return jwt.sign(payload, getPrivateKey(), { algorithm: 'RS256' })
}

async function fetchAccessToken(jwtToken: string): Promise<string> {
  const params = new URLSearchParams({
    assertion: jwtToken,
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    client_id: getEnv('CLIENT_ID'),
    client_secret: getEnv('CLIENT_SECRET'),
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
