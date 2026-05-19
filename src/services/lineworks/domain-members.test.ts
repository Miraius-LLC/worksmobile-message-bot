import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  listDomainMembers,
  listDomainMembersQuerySchema,
  registerDomainMember,
  registerDomainMemberSchema,
  unregisterDomainMember,
} from '@/services/lineworks/domain-members'

// =============================================================================
// Schema
// =============================================================================

describe('registerDomainMemberSchema', () => {
  test('userId 1 件は OK', () => {
    expect(registerDomainMemberSchema.safeParse({ userId: 'u1' }).success).toBe(true)
  })

  test('userId 空文字は reject', () => {
    expect(registerDomainMemberSchema.safeParse({ userId: '' }).success).toBe(false)
  })

  test('userId 欠落は reject', () => {
    expect(registerDomainMemberSchema.safeParse({}).success).toBe(false)
  })
})

describe('listDomainMembersQuerySchema', () => {
  test('count 1〜100 / cursor 任意 OK', () => {
    expect(listDomainMembersQuerySchema.safeParse({ count: 50, cursor: 'c1' }).success).toBe(true)
  })

  test('count 範囲外は reject', () => {
    expect(listDomainMembersQuerySchema.safeParse({ count: 0 }).success).toBe(false)
    expect(listDomainMembersQuerySchema.safeParse({ count: 101 }).success).toBe(false)
  })

  test('完全省略 OK', () => {
    expect(listDomainMembersQuerySchema.safeParse({}).success).toBe(true)
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

describe('registerDomainMember', () => {
  test('POST /bots/{botId}/domains/{domainId}/members を application/json で叩く', async () => {
    installFetch(() => new Response('', { status: 201 }))
    await registerDomainMember('tok', '400376434', { userId: 'u1' })
    expect(lastRequest?.init?.method).toBe('POST')
    expect(lastRequest?.url).toContain('/domains/400376434/members')
    expect(lastRequest?.init?.body).toBe(JSON.stringify({ userId: 'u1' }))
  })

  test('4xx は LineWorksApiError', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    await expect(registerDomainMember('tok', '400376434', { userId: 'u1' })).rejects.toThrow(
      'status=400',
    )
  })
})

describe('listDomainMembers', () => {
  const sample = {
    members: ['u1', 'u2'],
    responseMetaData: { nextCursor: 'c2' },
  }

  test('GET /domains/{domainId}/members を叩いて members を返す', async () => {
    installFetch(() => new Response(JSON.stringify(sample), { status: 200 }))
    const result = await listDomainMembers('tok', '400376434')
    expect(result.members).toEqual(['u1', 'u2'])
    expect(result.responseMetaData?.nextCursor).toBe('c2')
    expect(lastRequest?.url).toContain('/domains/400376434/members')
  })

  test('count / cursor query が URL に反映される', async () => {
    installFetch(() => new Response(JSON.stringify({ members: [] }), { status: 200 }))
    await listDomainMembers('tok', '400376434', { count: 20, cursor: 'abc' })
    expect(lastRequest?.url).toContain('count=20')
    expect(lastRequest?.url).toContain('cursor=abc')
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(listDomainMembers('tok', '400376434')).rejects.toThrow('status=500')
  })
})

describe('unregisterDomainMember', () => {
  test('DELETE /domains/{domainId}/members/{userId} を叩く (204)', async () => {
    installFetch(() => new Response('', { status: 204 }))
    await unregisterDomainMember('tok', '400376434', 'u1')
    expect(lastRequest?.init?.method).toBe('DELETE')
    expect(lastRequest?.url).toContain('/domains/400376434/members/u1')
  })

  test('404 は idempotent 成功', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    await expect(unregisterDomainMember('tok', '400376434', 'u1')).resolves.toBeUndefined()
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(unregisterDomainMember('tok', '400376434', 'u1')).rejects.toThrow('status=500')
  })
})
