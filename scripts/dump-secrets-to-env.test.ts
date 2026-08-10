import { describe, expect, test } from 'bun:test'
import { runSecretInjection } from './dump-secrets-to-env'

const template = ['Z_SECRET="{{ op://Vault/Item/z }}"', 'A_SECRET="{{ op://Vault/Item/a }}"'].join(
  '\n',
)

describe('runSecretInjection', () => {
  test('check は決定的な key 順で値を伏せ、ファイルを書かない', async () => {
    const writes: string[] = []
    const stdout: string[] = []

    const exitCode = await runSecretInjection({
      args: ['--check'],
      env: {},
      readFileFn: async () => template,
      existsSyncFn: () => false,
      writeFileFn: async path => {
        writes.push(path)
      },
      opReadFn: async reference => ({ ok: true, value: `value-for:${reference}` }),
      stdoutWrite: text => stdout.push(text),
      stderrWrite: () => {},
    })

    expect(exitCode).toBe(0)
    expect(writes).toEqual([])
    expect(stdout.join('')).toContain('✓ A_SECRET\n✓ Z_SECRET')
    expect(stdout.join('')).not.toContain('value-for:')
  })

  test('inject は secret の取得に1件でも失敗したらファイルを書かず失敗する', async () => {
    const writes: string[] = []

    const exitCode = await runSecretInjection({
      args: [],
      env: {},
      readFileFn: async () => template,
      existsSyncFn: () => true,
      writeFileFn: async path => {
        writes.push(path)
      },
      opReadFn: async reference =>
        reference.endsWith('/z')
          ? { ok: false, reason: 'not found' }
          : { ok: true, value: 'must-not-be-written' },
      stdoutWrite: () => {},
      stderrWrite: () => {},
    })

    expect(exitCode).toBe(1)
    expect(writes).toEqual([])
  })

  test.each([
    ['check', ['--check']],
    ['inject', []],
  ])('%s は failure reason に含まれる値を出力しない', async (_name, args) => {
    const stdout: string[] = []
    const stderr: string[] = []
    const sentinel = 'SENTINEL-SECRET-IN-REASON'

    const exitCode = await runSecretInjection({
      args,
      env: {},
      readFileFn: async () => template,
      existsSyncFn: () => false,
      writeFileFn: async () => {},
      opReadFn: async () => ({ ok: false, reason: `upstream leaked ${sentinel}` }),
      stdoutWrite: text => stdout.push(text),
      stderrWrite: text => stderr.push(text),
    })

    expect(exitCode).toBe(1)
    expect(`${stdout.join('')}\n${stderr.join('')}`).not.toContain(sentinel)
    expect(stdout.join('')).toContain('(取得失敗)')
  })
})
