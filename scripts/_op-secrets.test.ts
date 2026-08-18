import { describe, expect, test } from 'bun:test'
import Bun from 'bun'
import {
  formatCheckLines,
  parseTemplateReferences,
  pendingSecretReads,
  type ReadResult,
  resolveSecretsToEnv,
} from './_op-secrets'

const template = [
  '# comments are ignored',
  'CLIENT_ID="{{ op://Worksmobile/LINE WORKS Bot/client_id }}"',
  'CLIENT_SECRET="{{ op://Worksmobile/LINE WORKS Bot/client_secret }}"',
  'BASIC_ID="{{ op://Worksmobile/LINE WORKS Basic/basic_id }}"',
].join('\n')

describe('parseTemplateReferences', () => {
  test('.env.tpl の op inject 参照を env key ごとに読む', () => {
    expect(parseTemplateReferences(template)).toEqual({
      CLIENT_ID: 'op://Worksmobile/LINE WORKS Bot/client_id',
      CLIENT_SECRET: 'op://Worksmobile/LINE WORKS Bot/client_secret',
      BASIC_ID: 'op://Worksmobile/LINE WORKS Basic/basic_id',
    })
  })
})

describe('pendingSecretReads', () => {
  test('env-wins の時は既存 env を読まない', () => {
    expect(
      pendingSecretReads(parseTemplateReferences(template), { CLIENT_ID: 'from-env' }, false),
    ).toEqual([
      {
        envKey: 'CLIENT_SECRET',
        reference: 'op://Worksmobile/LINE WORKS Bot/client_secret',
      },
      {
        envKey: 'BASIC_ID',
        reference: 'op://Worksmobile/LINE WORKS Basic/basic_id',
      },
    ])
  })
})

describe('resolveSecretsToEnv', () => {
  test('環境変数がある key は 1Password を読まずに優先する', async () => {
    const calls: string[] = []
    const result = await resolveSecretsToEnv(template, {
      env: { CLIENT_ID: 'from-env' },
      opReadFn: async reference => {
        calls.push(reference)
        return { ok: true, value: `${reference}:value` }
      },
    })

    expect(calls).toEqual([
      'op://Worksmobile/LINE WORKS Bot/client_secret',
      'op://Worksmobile/LINE WORKS Basic/basic_id',
    ])
    expect(result.values.CLIENT_ID).toBe('from-env')
    expect(result.values.CLIENT_SECRET).toBe('op://Worksmobile/LINE WORKS Bot/client_secret:value')
  })

  test('ignoreEnv の時は既存 env を使わず全参照を読む', async () => {
    const calls: string[] = []
    const result = await resolveSecretsToEnv(template, {
      env: { CLIENT_ID: 'from-env' },
      ignoreEnv: true,
      opReadFn: async reference => {
        calls.push(reference)
        return { ok: true, value: `${reference}:from-op` }
      },
    })

    expect(calls).toHaveLength(3)
    expect(result.values.CLIENT_ID).toBe('op://Worksmobile/LINE WORKS Bot/client_id:from-op')
  })

  test('失敗は集約し、表示行に secret 値を含めない', async () => {
    const results = new Map<string, ReadResult>([
      ['op://Worksmobile/LINE WORKS Bot/client_id', { ok: true, value: 'secret-value' }],
      ['op://Worksmobile/LINE WORKS Bot/client_secret', { ok: false, reason: 'not found' }],
      ['op://Worksmobile/LINE WORKS Basic/basic_id', { ok: true, value: 'basic-id' }],
    ])
    const result = await resolveSecretsToEnv(template, {
      env: {},
      sleep: async () => {},
      opReadFn: async reference => results.get(reference) ?? { ok: false, reason: 'missing' },
    })

    expect(result.failures).toEqual([
      {
        envKey: 'CLIENT_SECRET',
        reference: 'op://Worksmobile/LINE WORKS Bot/client_secret',
        reason: 'not found',
      },
    ])
    expect(formatCheckLines(result).join('\n')).not.toContain('secret-value')
  })

  test('concurrency limit を守る', async () => {
    let activeReads = 0
    let maxActiveReads = 0

    await resolveSecretsToEnv(template, {
      env: {},
      concurrency: 2,
      opReadFn: async reference => {
        activeReads += 1
        maxActiveReads = Math.max(maxActiveReads, activeReads)
        await Promise.resolve()
        activeReads -= 1
        return { ok: true, value: reference }
      },
    })

    expect(maxActiveReads).toBeLessThanOrEqual(2)
  })

  test('一時的に落ちた参照は間隔を空けて拾い直す', async () => {
    const attempts = new Map<string, number>()
    const waits: number[] = []
    let firstReference = ''

    const result = await resolveSecretsToEnv(template, {
      env: {},
      concurrency: 3,
      sleep: async ms => {
        waits.push(ms)
      },
      opReadFn: async reference => {
        const attempt = (attempts.get(reference) ?? 0) + 1
        attempts.set(reference, attempt)
        if (!firstReference) firstReference = reference
        // desktop app への接続が詰まる状況を再現 (1 回目だけ落ちる)
        if (reference === firstReference && attempt === 1) {
          return { ok: false, reason: 'connecting to desktop app timed out' }
        }
        return { ok: true, value: reference }
      },
    })

    expect(attempts.get(firstReference)).toBe(2)
    expect(waits).toEqual([500])
    expect(result.failures).toEqual([])
  })

  test('拾い直しは最大 2 回。決定的な失敗は再試行しない', async () => {
    const attempts = new Map<string, number>()
    const waits: number[] = []
    let firstReference = ''

    const transient = await resolveSecretsToEnv(template, {
      env: {},
      concurrency: 3,
      sleep: async ms => {
        waits.push(ms)
      },
      opReadFn: async reference => {
        attempts.set(reference, (attempts.get(reference) ?? 0) + 1)
        if (!firstReference) firstReference = reference
        if (reference === firstReference) {
          return { ok: false, reason: 'connecting to desktop app timed out' }
        }
        return { ok: true, value: reference }
      },
    })

    expect(attempts.get(firstReference)).toBe(3)
    expect(waits).toEqual([500, 1500])
    expect(transient.failures).toHaveLength(1)

    const emptyAttempts = new Map<string, number>()
    const emptyWaits: number[] = []
    await resolveSecretsToEnv(template, {
      env: {},
      concurrency: 3,
      sleep: async ms => {
        emptyWaits.push(ms)
      },
      opReadFn: async reference => {
        const attempt = (emptyAttempts.get(reference) ?? 0) + 1
        emptyAttempts.set(reference, attempt)
        return { ok: false, reason: '値が空' }
      },
    })

    expect([...emptyAttempts.values()].every(count => count === 1)).toBe(true)
    expect(emptyWaits).toEqual([])
  })

  test('未サインイン時は最初の op read で止めて認証要求の多重起動を避ける', async () => {
    const calls: string[] = []
    const result = await resolveSecretsToEnv(template, {
      env: {},
      concurrency: 3,
      opReadFn: async reference => {
        calls.push(reference)
        return { ok: false, reason: 'not currently signed in', signinNeeded: true }
      },
    })

    expect(calls).toEqual(['op://Worksmobile/LINE WORKS Bot/client_id'])
    expect(result.signinNeeded).toBe(true)
    expect(result.failures).toHaveLength(3)
  })
})

describe('opRead の spawn 設定', () => {
  test('stdin を継承する (1Password デスクトップ承認の待ちに入れるようにする)', async () => {
    // Bun.spawn は既定で stdin を塞ぐ。塞ぐと op がデスクトップアプリの承認待ちへ入れず
    // 「connecting to desktop app timed out」で失敗する (501 が 2026-08-13、asunaro が
    // 2026-08-18 に dev で実測)。承認がキャッシュ済みの端末では成功してしまう。
    const source = await Bun.file(new URL('./_op-secrets.ts', import.meta.url)).text()
    const spawnCall = source.slice(source.indexOf('Bun.spawn(['))
    const options = spawnCall.slice(0, spawnCall.indexOf('})') + 1)

    expect(options).toContain("stdin: 'inherit'")
  })
})

describe('formatCheckLines', () => {
  test('内部 reason は固定カテゴリだけに変換して表示する', () => {
    const lines = formatCheckLines({
      values: {},
      failures: [
        {
          envKey: 'D_OTHER',
          reference: 'op://Vault/Item/d',
          reason: 'upstream leaked SENTINEL-SECRET',
        },
        {
          envKey: 'A_SIGNIN',
          reference: 'op://Vault/Item/a',
          reason: 'not currently signed in',
          signinNeeded: true,
        },
        {
          envKey: 'C_EMPTY',
          reference: 'op://Vault/Item/c',
          reason: '値が空',
        },
        {
          envKey: 'B_COMMAND',
          reference: 'op://Vault/Item/b',
          reason: 'op コマンドが見つかりません',
        },
      ],
      signinNeeded: true,
      references: {},
    })

    expect(lines.slice(0, 4)).toEqual([
      '✗ A_SIGNIN — op://Vault/Item/a (認証が必要)',
      '✗ B_COMMAND — op://Vault/Item/b (opコマンドなし)',
      '✗ C_EMPTY — op://Vault/Item/c (値が空)',
      '✗ D_OTHER — op://Vault/Item/d (取得失敗)',
    ])
    expect(lines.join('\n')).not.toContain('SENTINEL-SECRET')
  })
})
