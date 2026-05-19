import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  type BotCreateInput,
  botCreateSchema,
  botPatchSchema,
  createBot,
  deleteBot,
  getBot,
  listBots,
  patchBot,
  reissueBotSecret,
  replaceBot,
} from '@/services/lineworks/bots-tenant'

// =============================================================================
// Schema
// =============================================================================

const validBot: BotCreateInput = {
  botName: 'SUMIRE Group',
  photoUrl: 'https://example.com/photo.png',
  description: '職員通知 Bot',
  administrators: ['admin-user-id'],
}

describe('botCreateSchema', () => {
  test('必須 4 項目だけで OK', () => {
    expect(botCreateSchema.safeParse(validBot).success).toBe(true)
  })

  test('photoUrl が HTTP は reject (HTTPS 必須)', () => {
    expect(
      botCreateSchema.safeParse({ ...validBot, photoUrl: 'http://example.com/p.png' }).success,
    ).toBe(false)
  })

  test('botName 100 文字超は reject', () => {
    expect(botCreateSchema.safeParse({ ...validBot, botName: 'a'.repeat(101) }).success).toBe(false)
  })

  test('administrators 0 件は reject (min 1)', () => {
    expect(botCreateSchema.safeParse({ ...validBot, administrators: [] }).success).toBe(false)
  })

  test('administrators 4 件は reject (max 3)', () => {
    expect(
      botCreateSchema.safeParse({ ...validBot, administrators: ['a', 'b', 'c', 'd'] }).success,
    ).toBe(false)
  })

  test('callbackUrl が HTTPS なら OK', () => {
    expect(
      botCreateSchema.safeParse({
        ...validBot,
        enableCallback: true,
        callbackUrl: 'https://example.com/cb',
      }).success,
    ).toBe(true)
  })

  test('callbackUrl が HTTP は reject', () => {
    expect(
      botCreateSchema.safeParse({
        ...validBot,
        callbackUrl: 'http://example.com/cb',
      }).success,
    ).toBe(false)
  })

  test('callbackEvents に未知 type は reject', () => {
    expect(
      botCreateSchema.safeParse({
        ...validBot,
        callbackEvents: ['text', 'unknown_future'],
      }).success,
    ).toBe(false)
  })

  test('i18n フィールドが配列形式で渡せる', () => {
    expect(
      botCreateSchema.safeParse({
        ...validBot,
        i18nBotNames: [
          { language: 'ja_JP', value: '日本語名' },
          { language: 'en_US', value: 'English' },
        ],
      }).success,
    ).toBe(true)
  })
})

describe('botPatchSchema (部分更新)', () => {
  test('完全に空のオブジェクトでも OK (partial)', () => {
    expect(botPatchSchema.safeParse({}).success).toBe(true)
  })

  test('一部フィールドだけでも OK', () => {
    expect(botPatchSchema.safeParse({ botName: 'New Name' }).success).toBe(true)
  })

  test('それでも HTTPS チェックは効く', () => {
    expect(botPatchSchema.safeParse({ photoUrl: 'http://example.com/p.png' }).success).toBe(false)
  })
})

// =============================================================================
// HTTP 振る舞い (fetch mock)
// =============================================================================

let originalFetch: typeof globalThis.fetch
let lastRequest: { url: string; init: RequestInit | undefined } | undefined

function installFetch(response: () => Response) {
  lastRequest = undefined
  globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
    lastRequest = { url: String(url), init }
    return response()
  }) as unknown as typeof globalThis.fetch
}

beforeEach(() => {
  originalFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('createBot', () => {
  test('POST /bots を叩いて botId 含む BotInfo を返す', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify({ botId: 'b-001', ...validBot }), {
          status: 201,
        }),
    )
    const result = await createBot('tok', validBot)
    expect(result.botId).toBe('b-001')
    expect(lastRequest?.init?.method).toBe('POST')
    expect(lastRequest?.url).toMatch(/\/bots$/)
  })

  test('レスポンスに botId が無いと throw', async () => {
    installFetch(() => new Response(JSON.stringify(validBot), { status: 201 }))
    await expect(createBot('tok', validBot)).rejects.toThrow('botId')
  })

  test('upstream 4xx は LineWorksApiError', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    await expect(createBot('tok', validBot)).rejects.toThrow('status=400')
  })
})

describe('listBots', () => {
  test('200 + { bots: [...] } を bots[] として返す', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify({ bots: [{ botId: 'b-001', ...validBot }] }), { status: 200 }),
    )
    const result = await listBots('tok')
    expect(result.bots).toHaveLength(1)
    expect(result.bots[0]?.botId).toBe('b-001')
  })

  test('200 + 素配列レスポンスも受け付ける (spec 未確定の保険)', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify([{ botId: 'b-001', ...validBot }]), {
          status: 200,
        }),
    )
    const result = await listBots('tok')
    expect(result.bots).toHaveLength(1)
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(listBots('tok')).rejects.toThrow('status=500')
  })
})

describe('getBot', () => {
  test('200 + info を返す', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify({ botId: 'b-001', ...validBot }), {
          status: 200,
        }),
    )
    const info = await getBot('tok', 'b-001')
    expect(info?.botId).toBe('b-001')
  })

  test('404 は null', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    expect(await getBot('tok', 'b-999')).toBeNull()
  })
})

describe('replaceBot (PUT) / patchBot (PATCH)', () => {
  test('PUT を叩く', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify({ botId: 'b-001', ...validBot }), {
          status: 200,
        }),
    )
    await replaceBot('tok', 'b-001', validBot)
    expect(lastRequest?.init?.method).toBe('PUT')
    expect(lastRequest?.url).toContain('/bots/b-001')
  })

  test('PATCH を叩く (部分 body OK)', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify({ botId: 'b-001', ...validBot }), {
          status: 200,
        }),
    )
    await patchBot('tok', 'b-001', { botName: 'Renamed' })
    expect(lastRequest?.init?.method).toBe('PATCH')
    expect(lastRequest?.init?.body).toBe(JSON.stringify({ botName: 'Renamed' }))
  })

  test('PATCH も 4xx は LineWorksApiError', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    await expect(patchBot('tok', 'b-001', { botName: 'x' })).rejects.toThrow('status=400')
  })
})

describe('deleteBot', () => {
  test('DELETE 204 は成功扱い', async () => {
    installFetch(() => new Response('', { status: 204 }))
    await deleteBot('tok', 'b-001')
    expect(lastRequest?.init?.method).toBe('DELETE')
  })

  test('404 も idempotent', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    await expect(deleteBot('tok', 'b-001')).resolves.toBeUndefined()
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(deleteBot('tok', 'b-001')).rejects.toThrow('status=500')
  })
})

describe('reissueBotSecret', () => {
  test('POST /bots/{id}/secret を叩いて botSecret を返す', async () => {
    installFetch(
      () => new Response(JSON.stringify({ botSecret: 'new-secret-001' }), { status: 200 }),
    )
    const result = await reissueBotSecret('tok', 'b-001')
    expect(result.botSecret).toBe('new-secret-001')
    expect(lastRequest?.init?.method).toBe('POST')
    expect(lastRequest?.url).toContain('/bots/b-001/secret')
  })

  test('4xx は LineWorksApiError', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    await expect(reissueBotSecret('tok', 'b-001')).rejects.toThrow('status=400')
  })
})
