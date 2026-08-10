import { describe, expect, test } from 'bun:test'
import Bun from 'bun'
import {
  SECRET_INJECTION_ADAPTER,
  SECRET_INJECTION_SCENARIO_IDS,
} from './_secret-injection-adapter'

describe('secret injection conformance adapter', () => {
  test('contract v1 の template target を宣言する', () => {
    expect(SECRET_INJECTION_ADAPTER.contractVersion).toBe(1)
    expect(SECRET_INJECTION_ADAPTER.kind).toBe('template')
    expect(SECRET_INJECTION_ADAPTER.targets).toEqual([
      {
        name: 'default',
        templatePath: '.env.tpl',
        outputPath: '.env',
      },
    ])
    expect(SECRET_INJECTION_ADAPTER.scenarioIds).toBe(SECRET_INJECTION_SCENARIO_IDS)
  })

  test('contract v1 の scenario ID と順序を固定する', () => {
    expect(SECRET_INJECTION_SCENARIO_IDS).toEqual([
      'merge-preserves-unmanaged',
      'merge-quotes-values',
      'resolve-env-wins',
      'resolve-ignore-env',
      'resolve-signin-short-circuit',
      'resolve-bounded-concurrency',
      'check-deterministic-output',
      'check-redacts-values',
      'check-read-only',
      'inject-no-write-on-read-failure',
      'scripts-canonical-entrypoints',
      'key-drift',
    ])
  })

  test('package scripts は inject を正規入口、dump を互換 alias、check を非書込入口にする', async () => {
    const packageJson = await Bun.file('package.json').json()

    expect(packageJson.scripts['secrets:inject']).toBe('bun run ./scripts/dump-secrets-to-env.ts')
    expect(packageJson.scripts['secrets:dump']).toBe('bun run secrets:inject')
    expect(packageJson.scripts['secrets:check']).toBe(
      'bun run ./scripts/dump-secrets-to-env.ts --check',
    )
  })

  test('tracked template の全 key が有効な op reference を持つ', async () => {
    const template = await Bun.file('.env.tpl').text()
    const assignedKeys = template
      .replace(/\r\n/g, '\n')
      .split('\n')
      .flatMap(line => line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1] ?? [])
      .sort()
    const referenceKeys = Object.keys(
      SECRET_INJECTION_ADAPTER.parseTemplateReferences(template),
    ).sort()

    expect(referenceKeys).toEqual(assignedKeys)
  })
})
