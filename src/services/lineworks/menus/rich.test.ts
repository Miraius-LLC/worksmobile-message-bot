import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  createRichMenu,
  deleteRichMenu,
  listRichMenus,
  RICH_MENU_IMAGE_LIMITS,
  type RichMenuCreate,
  richMenuCreateSchema,
  setDefaultRichMenu,
  uploadRichMenuImage,
} from '@/services/lineworks/menus/rich'

// =============================================================================
// Schema 検証
// =============================================================================

const sampleBounds = { x: 0, y: 0, width: 2500, height: 843 } as const
const sampleAction = { type: 'postback' as const, label: 'go', data: 'action=go' }

const validMenu: RichMenuCreate = {
  richmenuName: 'test menu',
  size: { width: 2500, height: 843 },
  areas: [{ bounds: sampleBounds, action: sampleAction }],
}

describe('richMenuCreateSchema', () => {
  test('postback action は OK', () => {
    expect(richMenuCreateSchema.safeParse(validMenu).success).toBe(true)
  })

  test('size.height 1686 (full) も OK', () => {
    const full = {
      ...validMenu,
      size: { width: 2500, height: 1686 },
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2500, height: 1686 },
          action: { type: 'message' as const, label: 'msg', text: 'hi' },
        },
      ],
    }
    expect(richMenuCreateSchema.safeParse(full).success).toBe(true)
  })

  test('size.height が 843 / 1686 以外は reject', () => {
    const bad = { ...validMenu, size: { width: 2500, height: 1000 } }
    expect(richMenuCreateSchema.safeParse(bad).success).toBe(false)
  })

  test('size.width が 2500 以外は reject', () => {
    const bad = { ...validMenu, size: { width: 2400, height: 843 } }
    expect(richMenuCreateSchema.safeParse(bad).success).toBe(false)
  })

  test('areas が空配列は reject (min 1)', () => {
    const bad = { ...validMenu, areas: [] }
    expect(richMenuCreateSchema.safeParse(bad).success).toBe(false)
  })

  test('action.label が 20 文字超は reject', () => {
    const bad = {
      ...validMenu,
      areas: [
        {
          bounds: sampleBounds,
          action: {
            type: 'postback' as const,
            label: 'a'.repeat(21),
            data: 'x',
          },
        },
      ],
    }
    expect(richMenuCreateSchema.safeParse(bad).success).toBe(false)
  })

  test('uri action の uri が非 HTTPS でも http は OK', () => {
    const httpAction: RichMenuCreate = {
      ...validMenu,
      areas: [
        {
          bounds: sampleBounds,
          action: { type: 'uri', label: 'go', uri: 'http://example.com' },
        },
      ],
    }
    expect(richMenuCreateSchema.safeParse(httpAction).success).toBe(true)
  })

  test('uri action の uri が ftp は reject', () => {
    const bad = {
      ...validMenu,
      areas: [
        {
          bounds: sampleBounds,
          action: { type: 'uri' as const, label: 'go', uri: 'ftp://example.com' },
        },
      ],
    }
    expect(richMenuCreateSchema.safeParse(bad).success).toBe(false)
  })

  test('未知 action.type は reject (discriminatedUnion)', () => {
    const bad = {
      ...validMenu,
      areas: [
        {
          bounds: sampleBounds,
          action: { type: 'camera' as never, label: 'cam' },
        },
      ],
    }
    expect(richMenuCreateSchema.safeParse(bad).success).toBe(false)
  })

  test('bounds の width 0 は reject (min 1)', () => {
    const bad = {
      ...validMenu,
      areas: [
        {
          bounds: { x: 0, y: 0, width: 0, height: 100 },
          action: sampleAction,
        },
      ],
    }
    expect(richMenuCreateSchema.safeParse(bad).success).toBe(false)
  })
})

describe('RICH_MENU_IMAGE_LIMITS', () => {
  test('1MB / JPEG・PNG / 2 サイズが規定値', () => {
    expect(RICH_MENU_IMAGE_LIMITS.maxBytes).toBe(1024 * 1024)
    expect(RICH_MENU_IMAGE_LIMITS.allowedMimeTypes).toEqual(['image/jpeg', 'image/png'])
    expect(RICH_MENU_IMAGE_LIMITS.validDimensions).toHaveLength(2)
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

describe('createRichMenu', () => {
  test('POST /bots/{botId}/richmenus を application/json で叩いて richmenuId を返す', async () => {
    installFetch(() => new Response(JSON.stringify({ richmenuId: 'rm-001' }), { status: 201 }))
    const result = await createRichMenu('tok', validMenu)
    expect(result.richmenuId).toBe('rm-001')
    expect(lastRequest?.init?.method).toBe('POST')
    expect(lastRequest?.url).toContain('/richmenus')
    expect(lastRequest?.url).not.toContain('/richmenus/')
  })

  test('レスポンスに richmenuId が無いと throw', async () => {
    installFetch(() => new Response(JSON.stringify({}), { status: 201 }))
    await expect(createRichMenu('tok', validMenu)).rejects.toThrow('richmenuId')
  })

  test('upstream 4xx は LineWorksApiError', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    await expect(createRichMenu('tok', validMenu)).rejects.toThrow('status=400')
  })
})

describe('listRichMenus', () => {
  test('200 + { richmenus: [...] } を配列で返す', async () => {
    installFetch(
      () =>
        new Response(
          JSON.stringify({
            richmenus: [{ richmenuId: 'rm-001', ...validMenu }],
          }),
          { status: 200 },
        ),
    )
    const result = await listRichMenus('tok')
    expect(result).toHaveLength(1)
    expect(result[0]?.richmenuId).toBe('rm-001')
  })

  test('200 + 素の配列レスポンスも受け付ける (spec 不確定への保険)', async () => {
    installFetch(
      () =>
        new Response(JSON.stringify([{ richmenuId: 'rm-001', ...validMenu }]), {
          status: 200,
        }),
    )
    const result = await listRichMenus('tok')
    expect(result).toHaveLength(1)
  })

  test('500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(listRichMenus('tok')).rejects.toThrow('status=500')
  })
})

describe('uploadRichMenuImage', () => {
  test('POST /richmenus/{id}/image に multipart/form-data で送信', async () => {
    installFetch(() => new Response('', { status: 201 }))
    const blob = new Blob(['fake-image-bytes'], { type: 'image/png' })
    await uploadRichMenuImage('tok', 'rm-001', blob, 'menu.png')
    expect(lastRequest?.init?.method).toBe('POST')
    expect(lastRequest?.url).toContain('/richmenus/rm-001/image')
    // FormData は Content-Type を自動付与する。手動でセットしていないこと
    const headers = lastRequest?.init?.headers as Record<string, string> | undefined
    expect(headers?.['Content-Type']).toBeUndefined()
    expect(headers?.Authorization).toBe('Bearer tok')
    // body が FormData
    expect(lastRequest?.init?.body).toBeInstanceOf(FormData)
  })

  test('upstream 4xx は LineWorksApiError', async () => {
    installFetch(() => new Response('bad', { status: 400 }))
    const blob = new Blob([''], { type: 'image/png' })
    await expect(uploadRichMenuImage('tok', 'rm-001', blob, 'x.png')).rejects.toThrow('status=400')
  })
})

describe('setDefaultRichMenu', () => {
  test('POST /richmenus/{id}/set-default を叩く', async () => {
    installFetch(() => new Response('', { status: 200 }))
    await setDefaultRichMenu('tok', 'rm-001')
    expect(lastRequest?.init?.method).toBe('POST')
    expect(lastRequest?.url).toContain('/richmenus/rm-001/set-default')
  })

  test('upstream 4xx は LineWorksApiError', async () => {
    installFetch(() => new Response('bad', { status: 404 }))
    await expect(setDefaultRichMenu('tok', 'rm-001')).rejects.toThrow('status=404')
  })
})

describe('deleteRichMenu', () => {
  test('DELETE /richmenus/{id} を叩く (204)', async () => {
    installFetch(() => new Response('', { status: 204 }))
    await deleteRichMenu('tok', 'rm-001')
    expect(lastRequest?.init?.method).toBe('DELETE')
    expect(lastRequest?.url).toContain('/richmenus/rm-001')
  })

  test('upstream 404 は idempotent に成功扱い', async () => {
    installFetch(() => new Response('not found', { status: 404 }))
    await expect(deleteRichMenu('tok', 'rm-001')).resolves.toBeUndefined()
  })

  test('upstream 500 は LineWorksApiError', async () => {
    installFetch(() => new Response('boom', { status: 500 }))
    await expect(deleteRichMenu('tok', 'rm-001')).rejects.toThrow('status=500')
  })
})
