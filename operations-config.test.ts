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

  test('Cloud Build triggerは既存JSONを保持したfull bodyで停止・再開する', async () => {
    const plan = await file(
      new URL('./docs/superpowers/plans/2026-08-10-cloudflare-workers-cutover.md', import.meta.url),
    ).text()

    expect(plan).not.toContain(`--data '{"disabled":true}'`)
    expect(plan).toContain('trigger_json="$(gcloud builds triggers describe')
    expect(plan).toContain('serviceAccount,substitutions,disabled:true')
    expect(plan).toContain('serviceAccount,substitutions,disabled:false')
    expect(plan).toContain('--data-binary @-')
    expect(plan).toContain("jq -e '.disabled == true'")
    expect(plan).toContain("jq -e '.disabled == false'")
  })

  test('現在形の運用docsはWorkers主系と実測したCustom Domain切替を示す', async () => {
    const [readme, changelog, issueTracker, design, plan, cloudBuild, envTemplate] =
      await Promise.all([
        file(new URL('./README.md', import.meta.url)).text(),
        file(new URL('./CHANGELOG.md', import.meta.url)).text(),
        file(new URL('./docs/agents/issue-tracker.md', import.meta.url)).text(),
        file(
          new URL(
            './docs/superpowers/specs/2026-08-10-cloudflare-workers-cutover-design.md',
            import.meta.url,
          ),
        ).text(),
        file(
          new URL(
            './docs/superpowers/plans/2026-08-10-cloudflare-workers-cutover.md',
            import.meta.url,
          ),
        ).text(),
        file(new URL('./cloudbuild.yaml', import.meta.url)).text(),
        file(new URL('./.env.tpl', import.meta.url)).text(),
      ])

    expect(readme).toContain('## 本番デプロイ (Cloudflare Workers)')
    expect(readme).toContain('![Cloudflare Workers]')
    expect(readme).toContain('![Google Cloud Run]')
    expect(readme).toContain('**実行基盤**: Cloudflare Workers / Google Cloud Run')
    expect(readme).toContain(
      'GitHub Actions (CI 成功後) → Cloudflare Workers / Cloud Build → Cloud Run',
    )
    expect(readme).toContain('Task 7完了時点では、30分監視後も即時rollbackのためCloud Runを')
    expect(readme).toContain('Task 8の')
    expect(readme).toContain('default URL の `/health`')
    expect(readme).not.toContain('MS-A2 移行では')
    expect(readme).not.toContain('Cloud Run default URL の `/healthz`')
    expect(changelog).toContain('Cloudflare Workersを本番主系化')
    expect(changelog).toContain('GitHub Actions（CI成功後にWorkers deploy）')
    expect(issueTracker).toContain('[`TODO.md`](../../TODO.md)')
    expect(issueTracker).not.toContain('`TODO.md` も無い')
    expect(design).toContain('Cloudflare code `100117`')
    expect(design).not.toContain('override_existing_dns_record=true')
    expect(plan).toContain('run `31391499733`')
    expect(plan).not.toContain('Wrangler非TTY deployが既存CNAMEをCustom Domain recordへ置換する')
    expect(readme).toContain('restore_fallback()')
    expect(readme).toContain('wmbot_cutover_record_id=')
    expect(readme).toContain('gh run rerun "$WMBOT_FAILED_RUN_ID"')
    expect(readme).toContain('gh run watch "$WMBOT_FAILED_RUN_ID"')
    expect(cloudBuild).toContain('通常の本番CDはGitHub Actions → Cloudflare Workers')
    expect(cloudBuild).not.toContain('GitHub push → build → push → Cloud Run')
    expect(envTemplate).toContain('本番主系のWorkersはWrangler secret')
  })
})
