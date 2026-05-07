import { createSign } from 'node:crypto'
import { config } from '@/utils/config'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/auth'

const AUTH_URL = 'https://auth.worksmobile.com/oauth2/v2.0/token'

/** 期限切れ判定の安全マージン (秒)。トークンを使い切る前にこの時間を残して再取得する */
const REFRESH_MARGIN_SEC = 60

type CachedToken = {
  accessToken: string
  /** UNIX 秒 (絶対時刻) */
  expiresAt: number
}

let cached: CachedToken | null = null
/** 同時並列リクエスト時に複数本立つ fetch を 1 本にまとめる single-flight 用 */
let inFlight: Promise<CachedToken> | null = null

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

/**
 * RS256 で JWT を自前生成する。LINE WORKS は OAuth2 JWT-Bearer に準拠するため
 * `iss` / `sub` / `aud` / `iat` / `exp` の最小 5 claim で足りる。
 */
function generateJWT(): string {
  const cfg = config()
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      iss: cfg.clientId,
      sub: cfg.serviceAccount,
      aud: AUTH_URL,
      iat: issuedAt,
      exp: issuedAt + 60 * 60,
    }),
  )
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(cfg.privateKey, 'base64url')
  return `${header}.${payload}.${signature}`
}

async function fetchAccessToken(jwtToken: string): Promise<CachedToken> {
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

  const data = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) {
    throw new Error('アクセストークンがレスポンスに含まれていません。')
  }

  // expires_in は秒。LINE WORKS は通常 86400 (24h) を返す。フィールドが無い場合は 1 時間として扱う
  const ttlSec = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600
  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + ttlSec,
  }
}

function isFresh(token: CachedToken): boolean {
  return Math.floor(Date.now() / 1000) < token.expiresAt - REFRESH_MARGIN_SEC
}

/**
 * アクセストークンを取得する。キャッシュが有効ならそれを返す。
 * 期限切れ時の再取得は同時並列でも 1 本だけ走り、他は同じ Promise を待つ (single-flight)。
 */
export async function getServerToken(): Promise<string> {
  if (cached && isFresh(cached)) {
    return cached.accessToken
  }
  if (inFlight) {
    return (await inFlight).accessToken
  }

  inFlight = (async () => {
    try {
      const fresh = await fetchAccessToken(generateJWT())
      cached = fresh
      logger.success('アクセストークンを取得 (キャッシュ更新)', {
        caller: `${CALLER}.getServerToken`,
      })
      return fresh
    } finally {
      inFlight = null
    }
  })()

  return (await inFlight).accessToken
}

/** テスト用にキャッシュをリセットするフック (production からは呼ばない) */
export function _resetTokenCacheForTest(): void {
  cached = null
  inFlight = null
}
