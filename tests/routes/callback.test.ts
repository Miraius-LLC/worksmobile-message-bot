import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHmac } from 'node:crypto'

// LINE WORKS Bot Callback の受信ルート (`POST /callback`) の feature テスト。
// BASIC 認証は除外パスで素通り、`X-WORKS-Signature` の HMAC-SHA256 + raw body
// 検証で真正性を担保する設計のため、ここでは「署名 OK / NG」「Zod 検証 OK / NG」
// 「dispatcher 呼び出し」「dedup」の 4 観点をカバーする。
//
// dispatcher は `mock.module` で差し替えるため `app` は動的 import する
// (static import だと mock が間に合わず実装が import されてしまう)

const dispatchSpy = mock(async () => {})
mock.module('@/services/lineworks/callback/dispatch', () => ({
  dispatch: dispatchSpy,
}))

const { app } = await import('@/app')
const { _resetForTest: resetDedup } = await import('@/services/lineworks/callback/dedup')

// 各テスト前に dedup の内部 Map を空にする。`dedup.ts` は module-level state を
// 持つため、同じ fixture を使う test 間で「2 回目は重複扱い」になってしまうのを防ぐ
beforeEach(() => {
  resetDedup()
  dispatchSpy.mockClear()
})

// setup.ts で BOT_SECRET=test-bot-secret に固定済
const BOT_SECRET = 'test-bot-secret'

function sign(rawBody: string): string {
  return createHmac('sha256', BOT_SECRET).update(rawBody, 'utf8').digest('base64')
}

async function postCallback(rawBody: string, signature?: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (typeof signature === 'string') headers['x-works-signature'] = signature
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

describe('POST /callback: dispatcher 呼び出し', () => {
  test('200 を返す前に dispatch(event) を 1 回呼ぶ', async () => {
    dispatchSpy.mockClear()
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(200)
    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const args = dispatchSpy.mock.calls[0] as unknown as [unknown]
    expect(args[0]).toMatchObject({ type: 'message', source: messageEventFixture.source })
  })

  test('署名検証 NG では dispatch を呼ばない', async () => {
    dispatchSpy.mockClear()
    const raw = JSON.stringify(messageEventFixture)
    const res = await postCallback(raw, null)
    expect(res.status).toBe(401)
    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  test('Zod 検証 NG では dispatch を呼ばない', async () => {
    dispatchSpy.mockClear()
    const raw = JSON.stringify({ type: 'nope' })
    const res = await postCallback(raw, sign(raw))
    expect(res.status).toBe(400)
    expect(dispatchSpy).not.toHaveBeenCalled()
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
  test('同一 body の 2 回目は dispatch を呼ばず 200 を返す', async () => {
    const raw = JSON.stringify(messageEventFixture)
    const signature = sign(raw)

    const res1 = await postCallback(raw, signature)
    expect(res1.status).toBe(200)
    expect(dispatchSpy).toHaveBeenCalledTimes(1)

    const res2 = await postCallback(raw, signature)
    expect(res2.status).toBe(200)
    // dispatch は重複検出によりスキップされるため、合計 1 回のままになる
    expect(dispatchSpy).toHaveBeenCalledTimes(1)
  })

  test('異なる body は別々に dispatch される (key 衝突しない)', async () => {
    const raw1 = JSON.stringify({ ...messageEventFixture, issuedTime: '2026-01-04T05:00:00Z' })
    const raw2 = JSON.stringify({ ...messageEventFixture, issuedTime: '2026-01-04T06:00:00Z' })

    await postCallback(raw1, sign(raw1))
    await postCallback(raw2, sign(raw2))

    expect(dispatchSpy).toHaveBeenCalledTimes(2)
  })

  test('dispatch が throw した場合は dedup を unregister して再送を許可する', async () => {
    // 1 回目: dispatch を throw 化 → 500 → onError 経由
    dispatchSpy.mockImplementationOnce(async () => {
      throw new Error('dispatch failed')
    })
    const raw = JSON.stringify(messageEventFixture)
    const signature = sign(raw)

    const res1 = await postCallback(raw, signature)
    expect(res1.status).toBe(500)

    // 2 回目 (LINE WORKS の再送相当): dedup が unregister されているので再度 dispatch される
    const res2 = await postCallback(raw, signature)
    expect(res2.status).toBe(200)
    expect(dispatchSpy).toHaveBeenCalledTimes(2)
  })
})
