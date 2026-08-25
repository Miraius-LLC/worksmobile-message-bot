import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { file } from 'bun'

const adrCapabilities = {
  '0001-cloud-run-hono-bun.md': ['dual-runtime-deployment'],
  '0002-container-http1-only-no-h2c.md': ['dual-runtime-deployment'],
  '0003-jwt-node-crypto-rs256.md': ['lineworks-jwt-authentication'],
  '0004-callback-dedup-in-memory-5min.md': ['callback-delivery'],
  '0005-forward-callback-to-upstream.md': ['callback-delivery'],
  '0006-basic-auth-except-health-and-callback.md': ['public-http-authentication'],
  '0007-message-type-dispatcher.md': ['message-type-dispatch'],
  '0008-docker-cloud-build-constraints.md': ['dual-runtime-deployment'],
  '0009-dedicated-runtime-sa-public-repo-secrets.md': ['deployment-security'],
  '0010-dual-cloud-deployment.md': ['dual-runtime-deployment'],
  '0011-sanitized-original-record-for-public-repository.md': ['adr-publication-integrity'],
} as const

describe('ADRとOpenSpec current specのcoverage contract', () => {
  test('ADR-0001〜0011を固定mappingで過不足なく網羅する', async () => {
    const actualAdrFiles = (await readdir(new URL('./docs/adr/', import.meta.url)))
      .filter(name => /^\d{4}-.*\.md$/.test(name))
      .sort()

    expect(Object.keys(adrCapabilities).sort()).toEqual(actualAdrFiles)
  })

  test('各ADRと対応capabilityを双方向に辿れる', async () => {
    const specSources = new Map<string, string>()

    for (const [adrFile, capabilities] of Object.entries(adrCapabilities)) {
      const adr = await file(new URL(`./docs/adr/${adrFile}`, import.meta.url)).text()

      for (const capability of capabilities) {
        const adrToSpec = `../../openspec/specs/${capability}/spec.md`
        expect(adr, `${adrFile}から${capability}へのlink`).toContain(adrToSpec)

        let spec = specSources.get(capability)
        if (spec === undefined) {
          spec = await file(
            new URL(`./openspec/specs/${capability}/spec.md`, import.meta.url),
          ).text()
          specSources.set(capability, spec)
        }

        expect(spec, `${capability}から${adrFile}へのlink`).toContain(
          `../../../docs/adr/${adrFile}`,
        )
      }
    }
  })

  test('各backfill capabilityが現行仕様としてのPurposeを持つ', async () => {
    const capabilities = new Set(Object.values(adrCapabilities).flat())

    for (const capability of capabilities) {
      const spec = await file(
        new URL(`./openspec/specs/${capability}/spec.md`, import.meta.url),
      ).text()

      expect(spec).toContain('## Purpose\n\n')
      expect(spec).not.toContain('TBD -')
    }
  })

  test('superseded ADR-0001を独立current specへ復活させない', async () => {
    expect(
      await file(new URL('./openspec/specs/cloud-run-hono-bun/spec.md', import.meta.url)).exists(),
    ).toBeFalse()
    expect(adrCapabilities['0001-cloud-run-hono-bun.md']).toEqual(['dual-runtime-deployment'])
  })
})
