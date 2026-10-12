import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHmac } from 'node:crypto'

// LINE WORKS Bot Callback の受信ルート (`POST /callback`) の feature テスト。
// BASIC 認証は除外パスで素通り、`X-WORKS-Signature` の HMAC-SHA256 + raw body
// 検証で真正性を担保する設計のため、ここでは「署名 OK / NG」「Zod 検証 OK / NG」
// 「upstreamへの転送呼び出し」「dedup」の4観点をカバーする。
//
// 受信callbackをforwardEventToUpstream経由で任意のupstreamへ転送する。forwardモジュールを
// mock.module すると forward.test.ts (実装をテスト) にリークするため、ここでは
// **globalThis.fetchをスタブ**して実forwardEventToUpstreamを動かし、転送先fetchの
// 呼び出し回数・status でルート挙動を検証する (afterEach で fetch 復元、リークしない)。

const { app } = await import('@/app')
const { _resetForTest: resetDedup } = await import('@/services/lineworks/callback/dedup')
const { config } = await import('@/utils/config')

// setup.tsのFORWARD_CALLBACK_URLと一致させる
const FORWARD_URL = 'https://upstream.example.test/callback'

let originalFetch: typeof fetch
let forwardCalls: { url: string; init?: RequestInit }[]
let forwardStatus: number

beforeEach(() => {
  resetDedup()
  originalFetch = globalThis.fetch
  forwardCalls = []
  forwardStatus = 200
  globalThis.fetch = mock(async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    // upstreamへの転送だけを捕捉する（他のfetchがあれば素通し）
    if (url === FORWARD_URL) {
      forwardCalls.push({ url, init })
      return new Response(forwardStatus >= 400 ? 'err' : '', { status: forwardStatus })
    }
    return new Response('', { status: 200 })
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// setup.ts で BOT_SECRET=test-bot-secret に固定済
const BOT_SECRET = 'test-bot-secret'

function sign(rawBody: string): string {
  return createHmac('sha256', BOT_SECRET).update(rawBody, 'utf8').digest('base64')
}

async function postCallback(
  rawBody: string,
  signature?: string | null,
  botId: string | null = config().botId,
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (typeof signature === 'string') headers['x-works-signature'] = signature
  if (typeof botId === 'string') headers['x-works-botid'] = botId
  return app.request('/callback', { method: 'POST', headers, body: rawBody })
}

const messageEventFixture = {
  type: 'message',
  source: {
    userId: 'c72af563-0f21-4736-11e4-045237113344',
    channelId: '12345',
    domainId: 40029600,
  },
  issuedTime: '2026-01-04T05:16:05.716Z',
  content: { type: 'text', text: 'hello' },
}

describe('POST /callback: 本文サイズ制限', () => {
  test.each([
    ['Content-Lengthなし', {}],
    ['Content-Length過少申告', { 'content-length': '1' }],
  ])('%sの超過streamは署名検証前に413となり、末尾を読まず中断する', async (_label, headers) => {
    let chunksRead = 0
    const cancel = mock(() => {})
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          chunksRead += 1
          controller.enqueue(new Uint8Array(65_536).fill(65))
          if (chunksRead === 18) controller.close()
        },
        cancel,
      },
      { highWaterMark: 0 },
    )
    const request = new Request('https://bot.example.test/callback', {
      method: 'POST',
      headers,
      body,
      // 署名なしでもサイズ超過が先に拒否される
    })
    const res = await app.request(request)
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'callback body too large' })
    expect(chunksRead).toBe(17)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(forwardCalls.length).toBe(0)
  })

  test('上限ちょうどのUTF-8本文は文字途中のchunk境界でも署名とraw bodyを保って200', async () => {
    const event = JSON.stringify({ ...messageEventFixture, content: { type: 'text', text: 'あ' } })
    const encoder = new TextEncoder()
    const raw = event + ' '.repeat(1_048_576 - encoder.encode(event).byteLength)
    const bytes = encoder.encode(raw)
    const split = bytes.indexOf(0xe3) + 1
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, split))
        controller.enqueue(bytes.subarray(split))
        controller.close()
      },
    })
    const signature = sign(raw)
    const res = await app.request(
      new Request('https://bot.example.test/callback', {
        method: 'POST',
        headers: { 'x-works-signature': signature, 'x-works-botid': config().botId },
        body,
      }),
    )
    expect(res.status).toBe(200)
    expect(forwardCalls.length).toBe(1)
    expect(forwardCalls[0]?.init?.body).toBe(raw)
    expect(new Headers(forwardCalls[0]?.init?.headers).get('X-WORKS-Signature')).toBe(signature)

    const oversized = `${raw} `
    const rejected = await postCallback(oversized, sign(oversized))
    expect(rejected.status).toBe(413)
    expect(forwardCalls.length).toBe(1)
  })

  test('文字数が上限内でもUTF-8 byte数が上限超過なら413で転送しない', async () => {
    const raw = JSON.stringify({
      ...messageEventFixture,
      content: { type: 'text', text: 'あ'.repeat(350_000) },
    })
    expect(raw.length).toBeLessThan(1_048_576)
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(413)
    expect(forwardCalls.length).toBe(0)
  })
})

describe('POST /callback: 署名検証', () => {
  test('正しい署名 + 正しい event なら 200 + 空 body', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })

  test('X-WORKS-Signature ヘッダ無しは 401', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, null)
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: string }).error).toBe('invalid signature')
  })

  test('署名が改竄されていれば 401', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const signature = sign(raw)
    const tampered = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`
    const res = await postCallback(raw, tampered)
    expect(res.status).toBe(401)
  })

  test('body が改竄されていれば 401 (元の署名と一致しない)', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const signature = sign(raw)
    const tamperedRaw = `${raw.slice(0, raw.length - 2)}!"`
    const res = await postCallback(tamperedRaw, signature)
    expect(res.status).toBe(401)
  })

  test('BASIC 認証 ヘッダ無しでも /callback は受け付ける (PUBLIC_PATHS で除外)', async () => {
    const raw = JSON.stringify(messageEventFixture)
    // Authorization ヘッダを付けない (postCallback も付けていない) のに署名さえ正しければ 200
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(200)
  })
})

describe('POST /callback: Bot ID 検証', () => {
  test('X-WORKS-BotId ヘッダ欠落は 400 + { error: "missing bot id" }', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, sign(raw), null)
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('missing bot id')
  })

  test('X-WORKS-BotId ヘッダ不一致は 403 + { error: "bot id mismatch" }', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, sign(raw), 'wrong-bot-id')
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: string }).error).toBe('bot id mismatch')
  })

  test('正しい Bot ID + 正しい署名なら 200', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, sign(raw), config().botId)
    expect(res.status).toBe(200)
  })

  test('署名不正時は Bot ID チェック前に 401 を返す (Bot ID ヘッダ欠落/不一致でも 401)', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, null, 'wrong-bot-id')
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: string }).error).toBe('invalid signature')
  })
})

describe('POST /callback: body 検証', () => {
  test('JSON parse 不能な body は 400 + { error: "invalid json" }', async () => {
    const raw = 'this-is-not-json'
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('invalid json')
  })

  test('未知 type は Zod 検証で 400', async () => {
    const raw = JSON.stringify({
      type: 'unknown_event',
      source: { domainId: 1 },
      issuedTime: '2026-01-04T05:16:05.716Z',
    })
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(400)
  })

  test('必須フィールド欠落は 400', async () => {
    // message event の content を欠落
    const { content: _omit, ...broken } = messageEventFixture
    const raw = JSON.stringify(broken)
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(400)
  })
})

describe('POST /callback: upstreamへの転送', () => {
  test('200を返す前にupstreamへraw bodyと署名をそのまま転送する', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const signature = sign(raw)
    const res = await postCallback(raw, signature)
    expect(res.status).toBe(200)
    expect(forwardCalls.length).toBe(1)
    // raw body を 1 byte も変えず転送 + 署名ヘッダを引き継ぐ
    expect(forwardCalls[0]?.init?.body).toBe(raw)
    const headers = new Headers(forwardCalls[0]?.init?.headers)
    expect(headers.get('X-WORKS-Signature')).toBe(signature)
  })

  test('署名検証 NG では転送しない', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, null)
    expect(res.status).toBe(401)
    expect(forwardCalls.length).toBe(0)
  })

  test('Zod 検証 NG では転送しない', async () => {
    const raw = JSON.stringify({ type: 'nope' })
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(400)
    expect(forwardCalls.length).toBe(0)
  })

  test('upstreamが5xxを返すと500を返しdedup解除する (公式ページでは再送契約未確認・手動再投入用)', async () => {
    forwardStatus = 503
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(500)
    expect(forwardCalls.length).toBe(1)
  })

  test('upstreamが302を返すと500となり同じcallbackを再投入できる', async () => {
    forwardStatus = 302
    const raw = JSON.stringify(messageEventFixture)
    const signature = sign(raw)
    const first = await postCallback(raw, signature)
    expect(first.status).toBe(500)
    expect(forwardCalls.length).toBe(1)

    forwardStatus = 200
    const retry = await postCallback(raw, signature)
    expect(retry.status).toBe(200)
    expect(forwardCalls.length).toBe(2)
  })
})

describe('POST /callback: 8 event type 全て', () => {
  const fixtures = {
    message: messageEventFixture,
    postback: {
      type: 'postback',
      source: { userId: 'u1', channelId: 'c1', domainId: 1 },
      issuedTime: '2026-01-04T05:16:05.716Z',
      data: 'action=buy',
    },
    join: {
      type: 'join',
      source: { channelId: 'c1', domainId: 1 },
      issuedTime: '2026-01-04T05:16:05.716Z',
    },
    leave: {
      type: 'leave',
      source: { channelId: 'c1', domainId: 1 },
      issuedTime: '2026-01-04T05:16:05.716Z',
    },
    joined: {
      type: 'joined',
      source: { channelId: 'c1', domainId: 1 },
      issuedTime: '2026-01-04T05:16:05.716Z',
      members: ['u1'],
    },
    left: {
      type: 'left',
      source: { channelId: 'c1', domainId: 1 },
      issuedTime: '2026-01-04T05:16:05.716Z',
      members: ['u1'],
    },
    begin: {
      type: 'begin',
      source: { userId: 'u1', channelId: 'c1', domainId: 1 },
      issuedTime: '2026-01-04T05:16:05.716Z',
    },
    end: {
      type: 'end',
      source: { userId: 'u1', channelId: 'c1', domainId: 1 },
      issuedTime: '2026-01-04T05:16:05.716Z',
    },
  } as const

  for (const [type, fixture] of Object.entries(fixtures)) {
    test(`${type} event を 200 で受け取れる`, async () => {
      const raw = JSON.stringify(fixture)
      const res = await postCallback(raw, sign(raw))
      expect(res.status).toBe(200)
    })
  }
})

describe('POST /callback: dedup (5 分 window)', () => {
  test('同一 body の 2 回目は転送せず 200 を返す', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const signature = sign(raw)

    const res1 = await postCallback(raw, signature)
    expect(res1.status).toBe(200)
    expect(forwardCalls.length).toBe(1)

    const res2 = await postCallback(raw, signature)
    expect(res2.status).toBe(200)
    // 転送は重複検出によりスキップされるため、合計 1 回のままになる
    expect(forwardCalls.length).toBe(1)
  })

  test('異なる body は別々に転送される (key 衝突しない)', async () => {
    const raw1 = JSON.stringify({ ...messageEventFixture, issuedTime: '2026-01-04T05:00:00Z' })
    const raw2 = JSON.stringify({ ...messageEventFixture, issuedTime: '2026-01-04T06:00:00Z' })

    await postCallback(raw1, sign(raw1))
    await postCallback(raw2, sign(raw2))

    expect(forwardCalls.length).toBe(2)
  })

  test('転送が throw した場合は dedup を unregister し、手動再投入等での再実行を許可する', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const signature = sign(raw)

    // 1回目: upstreamが5xx → forward throw → 500 → onError経由
    forwardStatus = 503
    const res1 = await postCallback(raw, signature)
    expect(res1.status).toBe(500)

    // 2 回目 (手動再投入相当): dedup が unregister されているので再度転送される
    forwardStatus = 200
    const res2 = await postCallback(raw, signature)
    expect(res2.status).toBe(200)
    expect(forwardCalls.length).toBe(2)
  })

  test.each([
    ['JSON parse 不能', 'this-is-not-json'],
    [
      'Zod 検証 NG',
      JSON.stringify({
        type: 'unknown_event',
        source: { domainId: 1 },
        issuedTime: '2026-01-04T05:16:05.716Z',
      }),
    ],
  ])('%s の body は再送しても 400 (dedup key を残さない)', async (_label, raw) => {
    const signature = sign(raw)

    const res1 = await postCallback(raw, signature)
    expect(res1.status).toBe(400)

    const res2 = await postCallback(raw, signature)
    expect(res2.status).toBe(400)
    expect(forwardCalls.length).toBe(0)
  })
})
