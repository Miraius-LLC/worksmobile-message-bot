import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  botDomainPatchSchema,
  botDomainSchema,
  deleteBotDomain,
  listBotDomains,
  patchBotDomain,
  registerBotDomain,
  replaceBotDomain,
} from '@/services/lineworks/bots-domain'

describe('botDomainSchema', () => {
  test('公式フィールド visible / allowToSelectedMember は OK', () => {
    expect(botDomainSchema.safeParse({ visible: true, allowToSelectedMember: true }).success).toBe(
      true,
    )
  })

  test('空 body は公式のデフォルト値に任せるため OK', () => {
    expect(botDomainSchema.safeParse({}).success).toBe(true)
  })

  test('旧 administrators / enableCallback フィールドは reject', () => {
    expect(
      botDomainSchema.safeParse({
        administrators: ['a'],
        enableCallback: true,
      }).success,
    ).toBe(false)
  })

  test('partial は空オブジェクトも OK', () => {
    expect(botDomainPatchSchema.safeParse({}).success).toBe(true)
  })
})

// =============================================================================
// HTTP
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

describe('registerBotDomain', () => {
  test('POST /bots/{botId}/domains/{domainId}', async () => {
    installFetch(() => new Response('', { status: 201 }))
    await registerBotDomain('tok', 'b-001', 'd-001', {
      visible: true,
      allowToSelectedMember: true,
    })
    expect(lastRequest?.init?.method).toBe('POST')
    expect(lastRequest?.url).toContain('/bots/b-001/domains/d-001')
  })

  test('4xx は LineWorksApiError', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    await expect(registerBotDomain('tok', 'b-001', 'd-001', { visible: true })).rejects.toThrow(
      'status=400',
    )
  })
})

describe('listBotDomains', () => {
  test('200 + { domains: [...] }', async () => {
    installFetch(() => new Response(JSON.stringify({ domains: ['d-001'] }), { status: 200 }))
    const result = await listBotDomains('tok', 'b-001')
    expect(result.domains).toEqual(['d-001'])
    expect(lastRequest?.url).toContain('/bots/b-001/domains')
  })

  test('素配列レスポンスも許容', async () => {
    installFetch(() => new Response(JSON.stringify(['d-001']), { status: 200 }))
    const result = await listBotDomains('tok', 'b-001')
    expect(result.domains).toEqual(['d-001'])
  })

  test('query count / cursor を URL searchParams として転送し responseMetaData を保持する', async () => {
    installFetch(
      () =>
        new Response(
          JSON.stringify({
            domains: ['d-001'],
            responseMetaData: { nextCursor: 'domain-next-cur' },
          }),
          { status: 200 },
        ),
    )
    const result = await listBotDomains('tok', 'b-001', { count: 50, cursor: 'domain-cur' })
    expect(result.domains).toEqual(['d-001'])
    expect(result.responseMetaData).toEqual({ nextCursor: 'domain-next-cur' })
    expect(lastRequest?.url).toContain('count=50')
    expect(lastRequest?.url).toContain('cursor=domain-cur')
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(listBotDomains('tok', 'b-001')).rejects.toThrow('status=500')
  })
})

describe('replaceBotDomain (PUT) / patchBotDomain (PATCH)', () => {
  test('PUT を叩く', async () => {
    installFetch(() => new Response('', { status: 200 }))
    await replaceBotDomain('tok', 'b-001', 'd-001', { visible: true })
    expect(lastRequest?.init?.method).toBe('PUT')
  })

  test('PATCH を叩く (部分 body)', async () => {
    installFetch(() => new Response('', { status: 200 }))
    await patchBotDomain('tok', 'b-001', 'd-001', { allowToSelectedMember: true })
    expect(lastRequest?.init?.method).toBe('PATCH')
    expect(lastRequest?.init?.body).toBe(JSON.stringify({ allowToSelectedMember: true }))
  })
})

describe('deleteBotDomain', () => {
  test('DELETE 204', async () => {
    installFetch(() => new Response('', { status: 204 }))
    await deleteBotDomain('tok', 'b-001', 'd-001')
    expect(lastRequest?.init?.method).toBe('DELETE')
  })

  test('404 idempotent', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    await expect(deleteBotDomain('tok', 'b-001', 'd-001')).resolves.toBeUndefined()
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(deleteBotDomain('tok', 'b-001', 'd-001')).rejects.toThrow('status=500')
  })
})
