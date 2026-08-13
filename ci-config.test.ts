import { describe, expect, test } from 'bun:test'
import { file, YAML } from 'bun'

interface WorkflowStep {
  id?: string
  uses?: string
  run?: string
  env?: Record<string, string>
  with?: Record<string, string>
}

interface WorkflowJob {
  needs?: string
  if?: string
  concurrency?: {
    group?: string
    'cancel-in-progress'?: boolean
  }
  steps?: WorkflowStep[]
}

interface WorkflowConfig {
  on?: Record<string, unknown>
  jobs?: Record<string, WorkflowJob>
}

describe('CI workflow', () => {
  test('check job は token 不要の Wrangler dry-run を実行する', async () => {
    const source = await file(new URL('./.github/workflows/ci.yml', import.meta.url)).text()
    const workflow = YAML.parse(source) as WorkflowConfig
    const dryRunStep = workflow.jobs?.check?.steps?.find(step => step.id === 'wrangler-dry-run')

    expect(dryRunStep?.env?.WORKER_CUSTOM_DOMAIN).toBe('bot.example.com')
    expect(dryRunStep?.env?.OAUTH_SCOPE).toBe('bot')
    expect(dryRunStep?.run).toContain('bun scripts/create-wrangler-production-config.ts')
    expect(dryRunStep?.run).toContain(
      'bunx wrangler deploy --config wrangler.production.json --dry-run',
    )
  })

  test('CI成功済みmainだけをSHA pinしたWrangler actionでdeployする', async () => {
    const source = await file(new URL('./.github/workflows/ci.yml', import.meta.url)).text()
    const workflow = YAML.parse(source) as WorkflowConfig
    const deploy = workflow.jobs?.deploy
    const deployStep = deploy?.steps?.find(step => step.id === 'deploy')
    const productionConfigStep = deploy?.steps?.find(step =>
      step.run?.includes('create-wrangler-production-config.ts'),
    )
    const externalActions = deploy?.steps?.flatMap(step => (step.uses ? [step.uses] : [])) ?? []

    expect(workflow.on).toHaveProperty('workflow_dispatch')
    expect(deploy?.needs).toBe('check')
    expect(deploy?.if).toContain("github.ref == 'refs/heads/main'")
    expect(deploy?.concurrency).toEqual({
      group: 'cloudflare-workers-production',
      'cancel-in-progress': true,
    })
    expect(externalActions).toEqual([
      'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803',
      'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6',
      'cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0',
    ])
    expect(externalActions.every(action => /@[0-9a-f]{40}$/.test(action))).toBe(true)
    expect(deployStep?.uses).toBe(
      'cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0',
    )
    expect(deployStep?.with).toMatchObject({
      apiToken: `\${{ secrets.CLOUDFLARE_API_TOKEN }}`,
      accountId: `\${{ vars.CLOUDFLARE_ACCOUNT_ID }}`,
      wranglerVersion: '4.120.0',
      packageManager: 'bun',
      command:
        'deploy --config wrangler.production.json --message "GitHub Actions $' +
        '{{ github.sha }}"',
    })
    expect(productionConfigStep?.env?.WORKER_CUSTOM_DOMAIN).toBe(
      '$' + '{{ vars.WORKER_CUSTOM_DOMAIN }}',
    )
    expect(productionConfigStep?.env?.OAUTH_SCOPE).toBe('$' + '{{ vars.OAUTH_SCOPE }}')
    expect(productionConfigStep?.run).toContain('test -n "$WORKER_CUSTOM_DOMAIN"')
    expect(productionConfigStep?.run).toContain('bun scripts/create-wrangler-production-config.ts')
  })

  test('Biome gateはrootのconfig contract testsも検査する', async () => {
    const source = await file(new URL('./.github/workflows/ci.yml', import.meta.url)).text()
    const workflow = YAML.parse(source) as WorkflowConfig
    const biomeStep = workflow.jobs?.check?.steps?.find(step => step.run?.startsWith('bunx biome'))

    expect(biomeStep?.run).toContain('ci-config.test.ts')
    expect(biomeStep?.run).toContain('wrangler-config.test.ts')
    expect(biomeStep?.run).toContain('operations-config.test.ts')
  })
})
