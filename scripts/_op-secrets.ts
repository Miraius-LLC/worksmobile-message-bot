import Bun from 'bun'

export type SecretReadTarget = {
  envKey: string
  reference: string
}

export type ReadResult =
  | { ok: true; value: string }
  | { ok: false; reason: string; signinNeeded?: boolean }

export type SecretReadFailure = {
  envKey: string
  reference: string
  reason: string
}

export type ResolveSecretsOptions = {
  env?: Record<string, string | undefined>
  ignoreEnv?: boolean
  concurrency?: number
  opReadFn?: (reference: string) => ReadResult | Promise<ReadResult>
}

export type ResolveSecretsResult = {
  values: Record<string, string>
  failures: SecretReadFailure[]
  signinNeeded: boolean
  references: Record<string, string>
}

export const DEFAULT_OP_READ_CONCURRENCY = 6

export function parseTemplateReferences(template: string): Record<string, string> {
  const references: Record<string, string> = {}

  for (const line of template.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?\{\{\s*(op:\/\/.+?)\s*\}\}["']?\s*$/)
    if (match?.[1] && match[2]) references[match[1]] = match[2]
  }

  return references
}

export function pendingSecretReads(
  references: Record<string, string>,
  env: Record<string, string | undefined>,
  ignoreEnv: boolean,
): SecretReadTarget[] {
  return Object.entries(references)
    .filter(([envKey]) => ignoreEnv || !env[envKey])
    .map(([envKey, reference]) => ({ envKey, reference }))
}

export async function resolveSecretsToEnv(
  template: string,
  options: ResolveSecretsOptions = {},
): Promise<ResolveSecretsResult> {
  const env = options.env ?? process.env
  const concurrency = options.concurrency ?? DEFAULT_OP_READ_CONCURRENCY
  const opReadFn = options.opReadFn ?? opRead
  const references = parseTemplateReferences(template)
  const targets = pendingSecretReads(references, env, options.ignoreEnv ?? false)

  const values: Record<string, string> = {}
  const failures: SecretReadFailure[] = []
  let signinNeeded = false

  for (const [envKey, value] of Object.entries(env)) {
    if (!options.ignoreEnv && value && envKey in references) values[envKey] = value
  }

  const [firstTarget, ...restTargets] = targets
  const results: Array<{ target: SecretReadTarget; result: ReadResult }> = []

  if (firstTarget) {
    const firstResult = await opReadFn(firstTarget.reference)
    results.push({ target: firstTarget, result: firstResult })

    if (!firstResult.ok && firstResult.signinNeeded) {
      results.push(
        ...restTargets.map(target => ({
          target,
          result: { ok: false as const, reason: firstResult.reason },
        })),
      )
    } else {
      results.push(
        ...(await mapWithConcurrency(restTargets, concurrency, async target => ({
          target,
          result: await opReadFn(target.reference),
        }))),
      )
    }
  }

  for (const { target, result } of results) {
    if (result.ok) {
      values[target.envKey] = result.value
      continue
    }

    failures.push({
      envKey: target.envKey,
      reference: target.reference,
      reason: result.reason,
    })
    if (result.signinNeeded) signinNeeded = true
  }

  return { values, failures, signinNeeded, references }
}

export function formatCheckLines(result: ResolveSecretsResult): string[] {
  const lines: string[] = []

  for (const key of Object.keys(result.values).sort()) lines.push(`✓ ${key}`)
  for (const failure of result.failures.sort((a, b) => a.envKey.localeCompare(b.envKey))) {
    lines.push(`✗ ${failure.envKey} — ${failure.reference} (${failure.reason})`)
  }
  lines.push(
    '',
    `結果: ${Object.keys(result.values).length} 件取得可 / ${result.failures.length} 件取得失敗 (値は表示していません)`,
  )

  return lines
}

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<U>,
): Promise<U[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('concurrency must be a positive integer')
  }

  const results = new Array<U>(values.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      const value = values[index]
      if (value === undefined) continue
      results[index] = await mapper(value)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

async function opRead(reference: string): Promise<ReadResult> {
  let proc: Bun.Subprocess<'ignore', 'pipe', 'pipe'>

  try {
    proc = Bun.spawn(['op', 'read', reference], {
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, reason: 'op コマンドが見つかりません', signinNeeded: false }
    }
    throw error
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  if (exitCode !== 0) {
    return {
      ok: false,
      reason: stderr.trim().slice(0, 160) || '取得失敗',
      signinNeeded: /sign|account|authoriz|not currently/i.test(stderr),
    }
  }

  const value = stdout.replace(/\n+$/, '')
  return value ? { ok: true, value } : { ok: false, reason: '値が空' }
}
