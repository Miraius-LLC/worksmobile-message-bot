#!/usr/bin/env bun

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { mergeEnvContent } from './_env-merge'
import { formatCheckLines, type ReadResult, resolveSecretsToEnv } from './_op-secrets'
import { writeSecretFile } from './_secret-file'

type RunSecretInjectionOptions = {
  args?: string[]
  env?: Record<string, string | undefined>
  readFileFn?: (path: string) => Promise<string>
  existsSyncFn?: (path: string) => boolean
  writeFileFn?: (path: string, content: string, options: { mode: number }) => Promise<void>
  opReadFn?: (reference: string) => ReadResult | Promise<ReadResult>
  /** 拾い直しの待機。テストから no-op を差し込めるよう素通しする。 */
  sleep?: (ms: number) => Promise<void>
  stdoutWrite?: (text: string) => void
  stderrWrite?: (text: string) => void
}

export async function runSecretInjection(options: RunSecretInjectionOptions = {}): Promise<number> {
  const args = new Set(options.args ?? process.argv.slice(2))
  const checkOnly = args.has('--check')
  const preferEnv = args.has('--prefer-env')
  const templatePath = '.env.tpl'
  const envPath = '.env'
  const readFileFn = options.readFileFn ?? (async path => readFile(path, 'utf8'))
  const existsSyncFn = options.existsSyncFn ?? existsSync
  const writeFileFn =
    options.writeFileFn ??
    (async (path, content) => {
      await writeSecretFile(path, content)
    })
  const stdoutWrite = options.stdoutWrite ?? (text => process.stdout.write(text))
  const stderrWrite = options.stderrWrite ?? (text => process.stderr.write(text))

  const template = await readFileFn(templatePath)
  const result = await resolveSecretsToEnv(template, {
    env: options.env,
    ignoreEnv: !preferEnv,
    opReadFn: options.opReadFn,
    sleep: options.sleep,
  })

  stdoutWrite(`${formatCheckLines(result).join('\n')}\n`)

  if (result.signinNeeded) {
    stderrWrite('⚠️ 1Password にサインインしていません。`op signin` を実行してください。\n')
  }

  if (result.failures.length > 0) return 1
  if (checkOnly) return 0

  const existing = existsSyncFn(envPath) ? await readFileFn(envPath) : ''
  await writeFileFn(envPath, mergeEnvContent(existing, result.values), { mode: 0o600 })
  stderrWrite(
    `✅ ${Object.keys(result.values).length} 件の secret を ${envPath} にマージ書き込みしました\n`,
  )
  stderrWrite('   以後のローカル実行は .env を読むため、毎回 1Password を開きません。\n')
  return 0
}

if (import.meta.main) process.exitCode = await runSecretInjection()
