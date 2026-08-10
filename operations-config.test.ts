import { describe, expect, test } from 'bun:test'
import { file } from 'bun'

interface DnsFallbackProfile {
  hostname?: string
  type?: string
  content?: string
  ttl?: number
  proxied?: boolean
  verifiedAt?: string
  verifiedSource?: string
}

describe('operations config', () => {
  test('Cloud Run DNS fallback profileはlive検証済みCNAMEを固定する', async () => {
    const profile = (await file(
      new URL('./docs/operations/cloud-run-dns-fallback.json', import.meta.url),
    ).json()) as DnsFallbackProfile

    expect(profile).toEqual({
      hostname: 'line-works.api.miraius.co.jp',
      type: 'CNAME',
      content: 'ghs.googlehosted.com',
      ttl: 1,
      proxied: false,
      verifiedAt: '2026-08-10',
      verifiedSource: 'Cloudflare DNS API live GET for the miraius.co.jp zone',
    })
  })

  test('.gcloudignoreはGitと全env実体をupload対象外にする', async () => {
    const source = await file(new URL('./.gcloudignore', import.meta.url)).text()
    const patterns = source
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))

    expect(patterns).toContain('.git')
    expect(patterns).toContain('.git/**')
    expect(patterns).toContain('.env')
    expect(patterns).toContain('.env.*')
    expect(patterns.some(pattern => pattern === '!.env.tpl')).toBe(false)
  })
})
