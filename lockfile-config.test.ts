import { describe, expect, test } from 'bun:test'
import { file } from 'bun'

describe('bun.lock', () => {
  // `rm bun.lock && bun install` で再生成すると、版を上げるつもりのない依存まで巻き添えで動く。
  // ヘッダを固定しておけば、うっかりの再生成をここで検出できる。
  // configVersion 1 は workspaces の linker 既定を isolated へ切り替えるが、
  // この repo は単一 package なので hoisted のままで実害がない。
  test('lockfileVersion 2 / configVersion 1 を保つ', async () => {
    const lockfile = await file(new URL('./bun.lock', import.meta.url)).text()
    const header = JSON.parse(`${lockfile.split('"workspaces"')[0]?.replace(/,\s*$/, '')}}`)

    expect(header.lockfileVersion).toBe(2)
    expect(header.configVersion).toBe(1)
  })

  test('package.json に workspaces を持たない (configVersion 1 の前提)', async () => {
    const packageJson = (await file(new URL('./package.json', import.meta.url)).json()) as {
      workspaces?: unknown
    }

    expect(packageJson.workspaces).toBeUndefined()
  })
})
