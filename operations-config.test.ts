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

  test('本番runbookはtokenをargvへ展開せず想定外DNSを上書きしない', async () => {
    const readme = await file(new URL('./README.md', import.meta.url)).text()
    const plan = await file(
      new URL('./docs/superpowers/plans/2026-08-10-cloudflare-workers-cutover.md', import.meta.url),
    ).text()
    const runbooks = `${readme}\n${plan}`

    expect(runbooks).not.toMatch(/Authorization:\s*Bearer\s+\$[A-Za-z_]/)
    expect(runbooks).not.toContain('Authorization:Bearer $')
    expect(runbooks).toContain('curl --config - --fail-with-body --silent --show-error')
    expect(readme).not.toContain('wmbot_dns_id=')
    expect(readme).toContain('assert_dns_profile <<<"$wmbot_dns_current"')
  })
})
