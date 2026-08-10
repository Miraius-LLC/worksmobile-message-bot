import { describe, expect, test } from 'bun:test'

interface WorkflowStep {
  id?: string
  uses?: string
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
  test('CI成功済みmainだけをSHA pinしたWrangler actionでdeployする', async () => {
    const source = await Bun.file(new URL('./.github/workflows/ci.yml', import.meta.url)).text()
    const workflow = Bun.YAML.parse(source) as WorkflowConfig
    const deploy = workflow.jobs?.deploy
    const deployStep = deploy?.steps?.find(step => step.id === 'deploy')

    expect(workflow.on).toHaveProperty('workflow_dispatch')
    expect(deploy?.needs).toBe('check')
    expect(deploy?.if).toContain("github.ref == 'refs/heads/main'")
    expect(deploy?.concurrency).toEqual({
      group: 'cloudflare-workers-production',
      'cancel-in-progress': true,
    })
    expect(deployStep?.uses).toBe(
      'cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0',
    )
    expect(deployStep?.with).toMatchObject({
      apiToken: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
      accountId: '${{ vars.CLOUDFLARE_ACCOUNT_ID }}',
      wranglerVersion: '4.120.0',
      packageManager: 'bun',
    })
  })
})
