import { describe, expect, test } from 'bun:test'
import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  rmdir,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { SECRET_FILE_MODE, writeSecretFile } from './_secret-file'
import { runSecretInjection } from './dump-secrets-to-env'

const template = ['Z_SECRET="{{ op://Vault/Item/z }}"', 'A_SECRET="{{ op://Vault/Item/a }}"'].join(
  '\n',
)

/** 取得失敗は backoff (500ms + 1500ms) に入る。テストを実時間で待たせない。 */
const noSleep = async () => {}

describe('runSecretInjection', () => {
  test('sleep を resolveSecretsToEnv へ渡す (テストが実時間で待たないため)', async () => {
    const waits: number[] = []

    const exitCode = await runSecretInjection({
      args: ['--check'],
      env: {},
      readFileFn: async () => template,
      existsSyncFn: () => false,
      writeFileFn: async () => {},
      // 取得失敗は retriable なので backoff 経路に入る
      opReadFn: async () => ({ ok: false, reason: 'not found' }),
      sleep: async ms => {
        waits.push(ms)
      },
      stdoutWrite: () => {},
      stderrWrite: () => {},
    })

    expect(exitCode).toBe(1)
    expect(waits).toEqual([500, 1500])
  })

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
      sleep: noSleep,
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
      sleep: noSleep,
      stdoutWrite: text => stdout.push(text),
      stderrWrite: text => stderr.push(text),
    })

    expect(exitCode).toBe(1)
    expect(`${stdout.join('')}\n${stderr.join('')}`).not.toContain(sentinel)
    expect(stdout.join('')).toContain('(取得失敗)')
  })
})

describe('writeSecretFile', () => {
  test('新規作成ファイルは0600で、親ディレクトリのmodeを変更しない', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'worksmobile-secret-file-'))
    const target = path.join(directory, '.env')
    try {
      await chmod(directory, 0o755)
      const directoryMode = (await stat(directory)).mode & 0o777
      const temporaryPaths: string[] = []
      await writeSecretFile(target, 'TOKEN=sentinel\n', {
        writeTempFile: async (temporaryPath, content) => {
          temporaryPaths.push(temporaryPath)
          await writeFile(temporaryPath, content, { mode: SECRET_FILE_MODE })
        },
      })

      expect((await stat(target)).mode & 0o777).toBe(SECRET_FILE_MODE)
      expect((await stat(directory)).mode & 0o777).toBe(directoryMode)
      expect(await readFile(target, 'utf8')).toBe('TOKEN=sentinel\n')
      expect(temporaryPaths).toHaveLength(1)
      expect(path.dirname(temporaryPaths[0] as string)).toBe(directory)
      expect(temporaryPaths[0]).not.toBe(target)
    } finally {
      await unlink(target).catch(() => undefined)
      await rmdir(directory)
    }
  })

  test('既存の緩いmodeも0600へ修復する', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'worksmobile-secret-file-'))
    const target = path.join(directory, '.env')
    try {
      await writeFile(target, 'OLD=1\n', { mode: 0o644 })
      await chmod(target, 0o644)
      await writeSecretFile(target, 'NEW=1\n')

      expect((await stat(target)).mode & 0o777).toBe(SECRET_FILE_MODE)
      expect(await readFile(target, 'utf8')).toBe('NEW=1\n')
    } finally {
      await unlink(target).catch(() => undefined)
      await rmdir(directory)
    }
  })

  test('一時ファイル書込み失敗時は既存ファイルを保持する', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'worksmobile-secret-file-'))
    const target = path.join(directory, '.env')
    try {
      await writeFile(target, 'KEEP=1\n', { mode: SECRET_FILE_MODE })
      await expect(
        writeSecretFile(target, 'NEW=1\n', {
          writeTempFile: async () => {
            throw new Error('sentinel write failure')
          },
        }),
      ).rejects.toThrow('sentinel write failure')
      expect(await readFile(target, 'utf8')).toBe('KEEP=1\n')
    } finally {
      await unlink(target).catch(() => undefined)
      await rmdir(directory)
    }
  })

  test('atomic rename失敗時も既存ファイルを保持し一時ファイルを残さない', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'worksmobile-secret-file-'))
    const target = path.join(directory, '.env')
    const temporaryPaths: string[] = []
    try {
      await writeFile(target, 'KEEP=1\n', { mode: SECRET_FILE_MODE })
      await expect(
        writeSecretFile(target, 'NEW=1\n', {
          writeTempFile: async (temporaryPath, content) => {
            temporaryPaths.push(temporaryPath)
            await writeFile(temporaryPath, content, { mode: SECRET_FILE_MODE })
          },
          renameFile: async () => {
            throw new Error('sentinel rename failure')
          },
        }),
      ).rejects.toThrow('sentinel rename failure')
      expect(await readFile(target, 'utf8')).toBe('KEEP=1\n')
      expect(temporaryPaths).toHaveLength(1)
      await expect(stat(temporaryPaths[0] as string)).rejects.toThrow()
    } finally {
      await unlink(target).catch(() => undefined)
      await unlink(temporaryPaths[0] as string).catch(() => undefined)
      await rmdir(directory)
    }
  })

  test('symlinkの出力先を拒否する', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'worksmobile-secret-file-'))
    const realTarget = path.join(directory, 'real.env')
    const target = path.join(directory, '.env')
    try {
      await writeFile(realTarget, 'KEEP=1\n', { mode: SECRET_FILE_MODE })
      await symlink(realTarget, target)

      await expect(writeSecretFile(target, 'NEW=1\n')).rejects.toThrow('symlink')
      expect(await readFile(realTarget, 'utf8')).toBe('KEEP=1\n')
      expect((await lstat(target)).isSymbolicLink()).toBe(true)
    } finally {
      await unlink(target).catch(() => undefined)
      await unlink(realTarget).catch(() => undefined)
      await rmdir(directory)
    }
  })
})
