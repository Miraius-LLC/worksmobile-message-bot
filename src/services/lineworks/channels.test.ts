import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  createChannel,
  createChannelSchema,
  getChannel,
  leaveChannel,
  listChannelMembers,
  listMembersQuerySchema,
} from '@/services/lineworks/channels'

// =============================================================================
// Schema
// =============================================================================

describe('createChannelSchema', () => {
  test('members 1 件 + title 任意は OK', () => {
    expect(createChannelSchema.safeParse({ members: ['u1'] }).success).toBe(true)
  })

  test('members 100 件は OK (上限)', () => {
    const members = Array.from({ length: 100 }, (_, i) => `u${i}`)
    expect(createChannelSchema.safeParse({ members }).success).toBe(true)
  })

  test('members 0 件は reject', () => {
    expect(createChannelSchema.safeParse({ members: [] }).success).toBe(false)
  })

  test('members 101 件は reject (max 100)', () => {
    const members = Array.from({ length: 101 }, (_, i) => `u${i}`)
    expect(createChannelSchema.safeParse({ members }).success).toBe(false)
  })

  test('members に重複があれば reject', () => {
    expect(createChannelSchema.safeParse({ members: ['u1', 'u1'] }).success).toBe(false)
  })

  test('title が 1000 文字超は reject', () => {
    expect(
      createChannelSchema.safeParse({
        members: ['u1'],
        title: 'a'.repeat(1001),
      }).success,
    ).toBe(false)
  })
})

describe('listMembersQuerySchema', () => {
  test('count 1〜100 は OK (coerce で string も number になる)', () => {
    expect(listMembersQuerySchema.safeParse({ count: 50 }).success).toBe(true)
    expect(listMembersQuerySchema.safeParse({ count: '50' }).success).toBe(true)
  })

  test('count 0 は reject', () => {
    expect(listMembersQuerySchema.safeParse({ count: 0 }).success).toBe(false)
  })

  test('count 101 は reject', () => {
    expect(listMembersQuerySchema.safeParse({ count: 101 }).success).toBe(false)
  })

  test('count / cursor 省略 OK', () => {
    expect(listMembersQuerySchema.safeParse({}).success).toBe(true)
  })
})

// =============================================================================
// HTTP 振る舞い
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

describe('createChannel', () => {
  test('POST /bots/{botId}/channels を application/json で叩いて channelId を返す', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify({ channelId: 'ch-001', title: 'test' }), {
          status: 201,
        }),
    )
    const result = await createChannel('tok', { members: ['u1'], title: 'test' })
    expect(result.channelId).toBe('ch-001')
    expect(lastRequest?.init?.method).toBe('POST')
    expect(lastRequest?.url).toMatch(/\/channels$/)
  })

  test('レスポンスに channelId が無いと throw', async () => {
    installFetch(() => new Response(JSON.stringify({}), { status: 201 }))
    await expect(createChannel('tok', { members: ['u1'] })).rejects.toThrow('channelId')
  })

  test('4xx は LineWorksApiError', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    await expect(createChannel('tok', { members: ['u1'] })).rejects.toThrow('status=400')
  })
})

describe('getChannel', () => {
  const sampleInfo = {
    domainId: 400376434,
    channelId: 'ch-001',
    title: 'sample',
    channelType: { type: 'MULTI_USERS' as const },
  }

  test('GET /bots/{botId}/channels/{id} を叩いて info を返す', async () => {
    installFetch(() => new Response(JSON.stringify(sampleInfo), { status: 200 }))
    const result = await getChannel('tok', 'ch-001')
    expect(result?.channelId).toBe('ch-001')
    expect(lastRequest?.init?.method).toBe('GET')
    expect(lastRequest?.url).toContain('/channels/ch-001')
  })

  test('404 は null を返す', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    const result = await getChannel('tok', 'ch-999')
    expect(result).toBeNull()
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(getChannel('tok', 'ch-001')).rejects.toThrow('status=500')
  })
})

describe('leaveChannel', () => {
  test('DELETE /bots/{botId}/channels/{id} を叩く (204)', async () => {
    installFetch(() => new Response('', { status: 204 }))
    await leaveChannel('tok', 'ch-001')
    expect(lastRequest?.init?.method).toBe('DELETE')
    expect(lastRequest?.url).toContain('/channels/ch-001')
  })

  test('404 は idempotent 成功', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    await expect(leaveChannel('tok', 'ch-001')).resolves.toBeUndefined()
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(leaveChannel('tok', 'ch-001')).rejects.toThrow('status=500')
  })
})

describe('listChannelMembers', () => {
  const sample = { members: ['u1', 'u2'], responseMetaData: { nextCursor: 'c2' } }

  test('GET /channels/{id}/members を叩いて members を返す', async () => {
    installFetch(() => new Response(JSON.stringify(sample), { status: 200 }))
    const result = await listChannelMembers('tok', 'ch-001')
    expect(result.members).toEqual(['u1', 'u2'])
    expect(result.responseMetaData?.nextCursor).toBe('c2')
    expect(lastRequest?.url).toContain('/channels/ch-001/members')
  })

  test('count / cursor query が URL に反映される', async () => {
    installFetch(() => new Response(JSON.stringify({ members: [] }), { status: 200 }))
    await listChannelMembers('tok', 'ch-001', { count: 10, cursor: 'abc' })
    expect(lastRequest?.url).toContain('count=10')
    expect(lastRequest?.url).toContain('cursor=abc')
  })

  test('query 省略時は count / cursor を URL に含めない', async () => {
    installFetch(() => new Response(JSON.stringify({ members: [] }), { status: 200 }))
    await listChannelMembers('tok', 'ch-001')
    expect(lastRequest?.url).not.toContain('count=')
    expect(lastRequest?.url).not.toContain('cursor=')
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(listChannelMembers('tok', 'ch-001')).rejects.toThrow('status=500')
  })
})
