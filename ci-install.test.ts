import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Bun from 'bun'

const ROOT = import.meta.dirname
const SCRIPT = path.join(ROOT, 'scripts/ci-install.sh')
const NO_SCANNER_CONFIG = path.join(ROOT, '.github/bunfig.ci-no-scanner.toml')

// 呼び出し引数を STUB_LOG へ残すだけの bun スタブ。実 install は走らせない。
const STUB_SOURCE = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$STUB_LOG"
exit 0
`

let stubDir: string

beforeAll(() => {
  stubDir = mkdtempSync(path.join(tmpdir(), 'worksmobile-ci-install-'))
  const stub = path.join(stubDir, 'bun')
  writeFileSync(stub, STUB_SOURCE)
  chmodSync(stub, 0o755)
})

afterAll(() => {
  rmSync(stubDir, { recursive: true, force: true })
})

async function runInstall(options: { script?: string; label: string }) {
  const logPath = path.join(stubDir, `${options.label}.log`)
  writeFileSync(logPath, '')

  // tsconfig の noPropertyAccessFromIndexSignature とブラケット記法を避けるため分割代入する
  const { PATH: inheritedPath = '' } = process.env

  const proc = Bun.spawn([options.script ?? SCRIPT, '--frozen-lockfile'], {
    cwd: ROOT,
    env: {
      ...(process.env as Record<string, string>),
      PATH: `${stubDir}:${inheritedPath}`,
      STUB_LOG: logPath,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  const calls = readFileSync(logPath, 'utf8').split('\n').filter(Boolean)

  return { stdout, stderr, exitCode, calls }
}

describe('scripts/ci-install.sh', () => {
  test('scanner 無し bunfig を --config= で渡して bun install を呼ぶ', async () => {
    const result = await runInstall({ label: 'standard' })

    expect(result.exitCode).toBe(0)
    // 引数 (--frozen-lockfile) も後ろへ伝播する
    expect(result.calls).toEqual([`install --config=${NO_SCANNER_CONFIG} --frozen-lockfile`])
  })

  test('設定ファイルが無ければ install せず exit 1 で止まる (fail closed)', async () => {
    const fakeRepo = mkdtempSync(path.join(tmpdir(), 'worksmobile-ci-install-norepo-'))
    try {
      mkdirSync(path.join(fakeRepo, 'scripts'))
      const script = path.join(fakeRepo, 'scripts/ci-install.sh')
      copyFileSync(SCRIPT, script)
      chmodSync(script, 0o755)
      // .github/bunfig.ci-no-scanner.toml は置かない

      const result = await runInstall({ script, label: 'missing-config' })

      expect(result.exitCode).toBe(1)
      expect(result.calls).toEqual([])
      expect(result.stderr).toContain('::error::')
    } finally {
      rmSync(fakeRepo, { recursive: true, force: true })
    }
  })

  test('CI 用 bunfig は security セクションを持たない', async () => {
    const config = await Bun.file(NO_SCANNER_CONFIG).text()
    // 由来を説明するコメントに [install.security] の語が出るため、有効行だけで判定する
    const effective = config
      .split('\n')
      .filter(line => !line.trimStart().startsWith('#'))
      .join('\n')

    expect(effective).not.toContain('[install.security]')
    expect(effective).not.toMatch(/^\s*scanner\s*=/m)
    expect(effective).toContain('[install]')
  })

  test('root の bunfig.toml には scanner が残っている (手元の検査を消していない)', async () => {
    const rootConfig = await Bun.file(path.join(ROOT, 'bunfig.toml')).text()
    const effective = rootConfig
      .split('\n')
      .filter(line => !line.trimStart().startsWith('#'))
      .join('\n')

    expect(effective).toContain('[install.security]')
    expect(effective).toMatch(/^\s*scanner\s*=\s*"@socketsecurity\/bun-security-scanner"/m)
  })

  test('check / deploy の install は ci-install.sh を --frozen-lockfile 付きで呼ぶ', async () => {
    const workflow = await Bun.file(path.join(ROOT, '.github/workflows/ci.yml')).text()
    const calls = workflow.match(/\.\/scripts\/ci-install\.sh --frozen-lockfile/g) ?? []

    expect(calls.length).toBe(2)
    expect(workflow).not.toContain('run: bun install')
    expect(workflow).not.toContain('installOutput=')
  })
})
