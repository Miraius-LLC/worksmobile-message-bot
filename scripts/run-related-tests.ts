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

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

function pickTargets(stagedFiles: string[]): string[] {
  const targets = new Set<string>()
  for (const file of stagedFiles) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
    if (!existsSync(file)) continue // 削除されたファイルはスキップ

    if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      targets.add(file)
      continue
    }
    const testFile = file.replace(/\.tsx?$/, m => `.test${m}`)
    if (existsSync(testFile)) targets.add(testFile)
  }
  return [...targets]
}

const stagedFiles = process.argv.slice(2)
const targets = pickTargets(stagedFiles)

if (targets.length === 0) {
  console.log('No related tests for staged files. Skipping.')
  process.exit(0)
}

console.log(`Running ${targets.length} related test file(s):`)
for (const t of targets) console.log(`  - ${t}`)

const proc = Bun.spawn(['bun', 'test', ...targets.map(t => resolve(t))], {
  stdout: 'inherit',
  stderr: 'inherit',
})
const code = await proc.exited
process.exit(code)
