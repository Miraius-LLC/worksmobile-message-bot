import { describe, expect, test } from 'bun:test'
import { file } from 'bun'

type PackageJson = {
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
}

describe('OpenSpec repository contract', () => {
  test('repository-localのOpenSpec 1.10.0をtelemetry無効で実行する', async () => {
    const packageJson = (await file(
      new URL('./package.json', import.meta.url),
    ).json()) as PackageJson

    expect(packageJson.devDependencies?.['@fission-ai/openspec']).toBe('1.10.0')
    expect(packageJson.scripts?.spec).toBe('OPENSPEC_TELEMETRY=0 openspec')
    expect(packageJson.scripts?.['spec:validate']).toBe(
      'OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive',
    )
  })

  test('OpenSpec projectはspec-driven schemaと段階導入境界を宣言する', async () => {
    const [config, workflowSpec] = await Promise.all([
      file(new URL('./openspec/config.yaml', import.meta.url)).text(),
      file(
        new URL('./openspec/specs/change-specification-workflow/spec.md', import.meta.url),
      ).text(),
    ])

    expect(config).toContain('schema: spec-driven')
    expect(config).toContain('既存仕様を一括 backfill しない')
    expect(workflowSpec).toContain('API contract')
    expect(workflowSpec).toContain('依存関係だけの更新')
    expect(workflowSpec).toContain('OpenSpec 1.10.0')
  })

  test('pre-pushとCIは同じstrict validationを実行する', async () => {
    const [lefthook, workflow] = await Promise.all([
      file(new URL('./lefthook.yml', import.meta.url)).text(),
      file(new URL('./.github/workflows/ci.yml', import.meta.url)).text(),
    ])

    expect(lefthook).toContain('openspec-validate:')
    expect(lefthook).toContain('scripts/with-dev-env bun run spec:validate')
    expect(workflow).toContain('- name: Validate OpenSpec')
    expect(workflow).toContain('run: bun run spec:validate')
    expect(workflow).toContain('openspec-config.test.ts')
  })

  test('既存GraphifyとCodeGraphはlocal cache境界を維持する', async () => {
    const [mcp, codeGraph, graphifyIgnore, codeGraphIgnore, gitignore, lefthook] =
      await Promise.all([
        file(new URL('./.mcp.json', import.meta.url)).json(),
        file(new URL('./codegraph.json', import.meta.url)).json(),
        file(new URL('./.graphifyignore', import.meta.url)).text(),
        file(new URL('./.codegraph/.gitignore', import.meta.url)).text(),
        file(new URL('./.gitignore', import.meta.url)).text(),
        file(new URL('./lefthook.yml', import.meta.url)).text(),
      ])

    expect(mcp).toMatchObject({
      mcpServers: {
        codegraph: {
          type: 'stdio',
          command: 'codegraph',
          args: ['serve', '--mcp'],
        },
      },
    })
    expect(codeGraph).toEqual({
      exclude: ['.claude/', '.Codex/', '.agent-room-worktrees/'],
    })
    expect(graphifyIgnore).toContain('**/graphify-out/')
    expect(codeGraphIgnore.trim().split('\n').slice(-2)).toEqual(['*', '!.gitignore'])
    expect(gitignore.split('\n')).not.toContain('.codegraph/')
    expect(gitignore).toContain('graphify-out/')
    expect(lefthook.match(/graphify-refresh:/g)).toHaveLength(2)
  })
})
