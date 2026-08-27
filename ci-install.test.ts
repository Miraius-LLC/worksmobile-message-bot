import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Bun from 'bun'

const ROOT = import.meta.dirname
const SCRIPT = path.join(ROOT, 'scripts/ci-install.sh')

// scanner 障害を模した bun スタブ。STUB_MODE で挙動を切り替え、呼び出し引数を STUB_LOG へ残す。
const STUB_SOURCE = `#!/usr/bin/env bash
if [ -n "\${SOCKET_API_KEY:-}" ]; then keyState=present; else keyState=absent; fi
printf '%s\\tkey=%s\\n' "$*" "$keyState" >> "$STUB_LOG"
case "$STUB_MODE" in
  scanner)
    case "$*" in
      *bunfig.ci-no-scanner*) echo "installed without scanner"; exit 0 ;;
    esac
    echo "error: Security scanner failed: unknown certificate verification error"
    echo "error: security scanner failed: ScannerFailed"
    exit 1
    ;;
  other)
    echo "error: lockfile had changes, but lockfile is frozen"
    exit 1
    ;;
  free-mode-other)
    # scanner が成功したときの警告を出しつつ、別の理由で落ちる。
    # 出力の部分一致で scanner 由来と誤判定してはいけない。
    echo "⚠ Socket Security Scanner free mode. Set SOCKET_API_KEY to use your Socket org settings."
    echo "error: lockfile had changes, but lockfile is frozen"
    exit 1
    ;;
  *)
    echo "ok"
    exit 0
    ;;
esac
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

async function runInstall(options: {
  mode: 'scanner' | 'other' | 'free-mode-other' | 'ok'
  event?: string
  socketApiKey?: string
}) {
  const logPath = path.join(stubDir, `${options.mode}-${options.event ?? 'unset'}.log`)
  writeFileSync(logPath, '')

  // tsconfig の noPropertyAccessFromIndexSignature とブラケット記法を避けるため分割代入する
  const { PATH: inheritedPath = '' } = process.env

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: `${stubDir}:${inheritedPath}`,
    STUB_MODE: options.mode,
    STUB_LOG: logPath,
    CI_INSTALL_RETRY_SLEEP: '0',
    ...(options.event === undefined ? {} : { GITHUB_EVENT_NAME: options.event }),
    ...(options.socketApiKey === undefined ? {} : { SOCKET_API_KEY: options.socketApiKey }),
  }
  // 未指定なら親から継承した値を落とす (biome の noDelete があるため Reflect.deleteProperty)
  if (options.event === undefined) Reflect.deleteProperty(env, 'GITHUB_EVENT_NAME')
  if (options.socketApiKey === undefined) Reflect.deleteProperty(env, 'SOCKET_API_KEY')

  const proc = Bun.spawn([SCRIPT, '--frozen-lockfile'], {
    cwd: ROOT,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  const lines = readFileSync(logPath, 'utf8').split('\n').filter(Boolean)
  const calls = lines.map(line => line.split('\t')[0] ?? '')
  const apiKeyStates = lines.map(line => line.split('\t')[1] ?? '')

  return { stdout, exitCode, calls, apiKeyStates }
}

describe('scripts/ci-install.sh', () => {
  test('install が成功したら 1 回で終わる', async () => {
    const result = await runInstall({ mode: 'ok', event: 'push' })

    expect(result.exitCode).toBe(0)
    expect(result.calls).toEqual(['install --frozen-lockfile'])
  })

  test('scanner と無関係の失敗はリトライせず即座に落ちる', async () => {
    const result = await runInstall({ mode: 'other', event: 'push' })

    expect(result.exitCode).toBe(1)
    expect(result.calls.length).toBe(1)
    expect(result.stdout).toContain('lockfile is frozen')
  })

  test('push は scanner 障害を 3 回試してから scanner 無し bunfig でフォールバックする', async () => {
    const result = await runInstall({ mode: 'scanner', event: 'push', socketApiKey: 'dummy' })

    expect(result.exitCode).toBe(0)
    expect(result.calls.length).toBe(4)
    expect(result.calls.slice(0, 3)).toEqual(Array(3).fill('install --frozen-lockfile'))
    // フォールバックでも引数 (--frozen-lockfile) が伝播する
    expect(result.calls[3]).toBe(
      '--config=./.github/bunfig.ci-no-scanner.toml install --frozen-lockfile',
    )
    expect(result.stdout).toContain('retrying without SOCKET_API_KEY')
  })

  test('SOCKET_API_KEY は 1 回目だけ渡り、2 回目以降は実際に外れる', async () => {
    const result = await runInstall({ mode: 'scanner', event: 'push', socketApiKey: 'dummy' })

    // 表示メッセージではなく、偽 bun が実際に受け取った env で検証する
    expect(result.apiKeyStates).toEqual(['key=present', 'key=absent', 'key=absent', 'key=absent'])
  })

  test('scanner 成功時の free mode 警告を scanner 由来の失敗と誤判定しない', async () => {
    const result = await runInstall({ mode: 'free-mode-other', event: 'push' })

    // 出力に "Socket Security Scanner" の語が含まれても、error 行が scanner でなければ
    // リトライも fallback もしない (本物の失敗を薄めない / 迂回を広げない)
    expect(result.exitCode).toBe(1)
    expect(result.calls.length).toBe(1)
    expect(result.calls.join('\n')).not.toContain('bunfig.ci-no-scanner')
    expect(result.stdout).toContain('Socket Security Scanner free mode')
  })

  test('pull_request は scanner を迂回せず落ちる', async () => {
    const result = await runInstall({
      mode: 'scanner',
      event: 'pull_request',
      socketApiKey: 'dummy',
    })

    expect(result.exitCode).toBe(1)
    expect(result.calls.length).toBe(3)
    expect(result.calls.join('\n')).not.toContain('bunfig.ci-no-scanner')
    expect(result.stdout).toContain('::error::')
  })

  test('push 以外のイベント (workflow_dispatch / 未設定) も迂回しない', async () => {
    for (const event of ['workflow_dispatch', undefined]) {
      const result = await runInstall({ mode: 'scanner', event })

      expect(result.exitCode).toBe(1)
      expect(result.calls.join('\n')).not.toContain('bunfig.ci-no-scanner')
    }
  })

  test('check / deploy の install は ci-install.sh を --frozen-lockfile 付きで呼ぶ', async () => {
    const workflow = await Bun.file(path.join(ROOT, '.github/workflows/ci.yml')).text()
    const calls = workflow.match(/\.\/scripts\/ci-install\.sh --frozen-lockfile/g) ?? []

    expect(calls.length).toBe(2)
    expect(workflow).not.toContain('run: bun install')
    expect(workflow).not.toContain('installOutput=')
  })

  test('フォールバック用 bunfig は security セクションを持たない', async () => {
    const fallback = await Bun.file(path.join(ROOT, '.github/bunfig.ci-no-scanner.toml')).text()
    // 由来を説明するコメントに [install.security] の語が出るため、有効行だけで判定する
    const effective = fallback
      .split('\n')
      .filter(line => !line.trimStart().startsWith('#'))
      .join('\n')

    expect(effective).not.toContain('[install.security]')
    expect(effective).not.toMatch(/^\s*scanner\s*=/m)
    expect(effective).toContain('[install]')
  })
})
