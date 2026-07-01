#!/usr/bin/env bun

/**
 * lefthook の pre-commit から呼ばれるヘルパ。
 *
 * 引数として渡された staged ファイル一覧から、関連する `*.test.ts` を抽出して
 * `bun test` を一括実行する。
 *
 * - `src/foo/bar.ts` がステージされていれば `src/foo/bar.test.ts` を対象に追加
 * - `src/foo/bar.test.ts` 自身がステージされていればそれをそのまま対象に追加
 * - 該当テストが 1 件も無ければ何もせず exit 0
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const TYPESCRIPT_FILE_RE = /\.tsx?$/
const TYPESCRIPT_TEST_FILE_RE = /\.test\.tsx?$/
const TYPESCRIPT_DECLARATION_FILE_RE = /\.d\.tsx?$/

type FileExists = (file: string) => boolean

export function toRelatedTestFile(file: string): string {
  return file.replace(/\.tsx?$/, extension => `.test${extension}`)
}

export function pickTargets(stagedFiles: string[], fileExists: FileExists = existsSync): string[] {
  const targets = new Set<string>()
  const seen = new Set<string>()

  for (const file of stagedFiles) {
    if (seen.has(file)) continue
    seen.add(file)

    if (!TYPESCRIPT_FILE_RE.test(file)) continue
    if (TYPESCRIPT_DECLARATION_FILE_RE.test(file)) continue
    if (!fileExists(file)) continue // 削除されたファイルはスキップ

    if (TYPESCRIPT_TEST_FILE_RE.test(file)) {
      targets.add(file)
      continue
    }

    const testFile = toRelatedTestFile(file)
    if (fileExists(testFile)) targets.add(testFile)
  }

  return [...targets]
}

function writeLine(message: string): void {
  process.stdout.write(`${message}\n`)
}

function runTests(targets: string[]): Promise<number> {
  const proc = spawn('bun', ['test', ...targets.map(target => resolve(target))], {
    stdio: 'inherit',
  })

  return new Promise(resolveCode => {
    proc.on('error', () => resolveCode(1))
    proc.on('close', code => resolveCode(code ?? 1))
  })
}

async function main(stagedFiles: string[]): Promise<number> {
  const targets = pickTargets(stagedFiles)

  if (targets.length === 0) {
    writeLine('No related tests for staged files. Skipping.')
    return 0
  }

  writeLine(`Running ${targets.length} related test file(s):`)
  for (const target of targets) writeLine(`  - ${target}`)

  return await runTests(targets)
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)))
}
