#!/usr/bin/env bun

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { mergeEnvContent } from './_env-merge'
import { formatCheckLines, resolveSecretsToEnv } from './_op-secrets'

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const preferEnv = args.has('--prefer-env')
const templatePath = '.env.tpl'
const envPath = '.env'

const template = await readFile(templatePath, 'utf8')
const result = await resolveSecretsToEnv(template, { ignoreEnv: !preferEnv })

process.stdout.write(`${formatCheckLines(result).join('\n')}\n`)

if (result.signinNeeded) {
  process.stderr.write('⚠️ 1Password にサインインしていません。`op signin` を実行してください。\n')
}

if (result.failures.length > 0) {
  process.exitCode = 1
} else if (!checkOnly) {
  const existing = existsSync(envPath) ? await readFile(envPath, 'utf8') : ''
  await writeFile(envPath, mergeEnvContent(existing, result.values), { mode: 0o600 })
  process.stderr.write(
    `✅ ${Object.keys(result.values).length} 件の secret を ${envPath} にマージ書き込みしました\n`,
  )
  process.stderr.write('   以後のローカル実行は .env を読むため、毎回 1Password を開きません。\n')
}
