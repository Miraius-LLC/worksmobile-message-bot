#!/usr/bin/env bun
/** staged された docs/adr を、--index-file が指す index の契約と比較基準で検査する。 */

import { realpath, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { isAbsolute, relative, resolve } from 'node:path'
import { hasStagedAdrNumberingChanges, inspect, inspectStagedNumbering, isAdrDocumentPath, parseAdrContract, type AdrNumberingBaseline, type Issue, type StagedFile, ADR_CONTRACT_RELATIVE_PATH, ADR_TEMPLATE_BASELINE_RELATIVE_PATH, ADR_TEMPLATE_RELATIVE_PATH } from './_adr-standard-core.ts'

const indexFile = parseIndexFile(process.argv.slice(2))
const repo = await git(process.cwd(), null, ['rev-parse', '--show-toplevel']).then(text => text.trim()).catch((error: Error) => failRead(error.message))
const resolvedIndex = indexFile ? await resolveIndexFile(process.cwd(), repo, indexFile) : null
const unmergedEntries = await gitOrFail(repo, resolvedIndex, ['ls-files', '--unmerged', '-z', '--', 'docs/adr'])
if (unmergedEntries !== '') failRead('unmerged-index: index に未解決の競合があります')
const stagedPaths = (await gitOrFail(repo, resolvedIndex, ['diff', '--cached', '--no-renames', '--diff-filter=ACMRTD', '--name-only', '-z', '--', 'docs/adr'])).split('\0').filter(Boolean)
const changedAdrPaths = stagedPaths.filter(isAdrDocumentPath)
const numberingChanged = hasStagedAdrNumberingChanges(stagedPaths)
const indexAdrPaths = numberingChanged
  ? (await gitOrFail(repo, resolvedIndex, ['ls-files', '--cached', '-z', '--', 'docs/adr'])).split('\0').filter(Boolean)
  : []
const indexAdrPathSet = new Set(indexAdrPaths)
const adrNames = changedAdrPaths.filter(path => indexAdrPathSet.has(path))

const contractText = await indexBlob(repo, resolvedIndex, ADR_CONTRACT_RELATIVE_PATH)
const template = await indexBlob(repo, resolvedIndex, ADR_TEMPLATE_RELATIVE_PATH)
const baseline = await indexBlob(repo, resolvedIndex, ADR_TEMPLATE_BASELINE_RELATIVE_PATH)
const readme = await indexBlob(repo, resolvedIndex, 'docs/adr/README.md')
if (contractText === null) failRead(`${ADR_CONTRACT_RELATIVE_PATH} が index にありません`)
if (template === null) failRead(`${ADR_TEMPLATE_RELATIVE_PATH} が index にありません`)
if (baseline === null) failRead(`${ADR_TEMPLATE_BASELINE_RELATIVE_PATH} が index にありません`)
if (readme === null) failRead('docs/adr/README.md が index にありません')
const parsed = parseAdrContract(contractText)
if (!parsed.ok) failRead(parsed.message)
if (!numberingChanged) finish([])
const headPaths = await headAdrPaths(repo)
const numberingBaseline: AdrNumberingBaseline = {
  changedPaths: stagedPaths,
  indexPaths: indexAdrPaths,
  headPaths,
  indexReservedNumbers: parsed.contract.reservedNumbers,
}
if (adrNames.length === 0) finish(inspectStagedNumbering(numberingBaseline))

const files: StagedFile[] = []
for (const path of adrNames) {
  const content = await indexBlob(repo, resolvedIndex, path)
  if (content === null) failRead(`${path} が index にありません`)
  files.push({ name: path.split('/')[2] ?? path, content })
}
finish(inspect({
  files,
  template,
  baseline,
  readme,
  contract: parsed.contract,
  fullTree: false,
  numberingBaseline,
}))

function parseIndexFile(args: string[]): string | null {
  let indexFile: string | null = null
  for (let position = 0; position < args.length; position += 1) {
    const arg = args[position] ?? ''
    if (arg === '--help' || arg === '-h') {
      console.log('check-staged-adr [--index-file PATH]')
      process.exit(0)
    }
    if (arg !== '--index-file') failRead(`不明な引数: ${arg}`)
    if (indexFile !== null) failRead('--index-file は 1 回だけ指定できます')
    const path = args[position + 1]
    if (path === undefined || path === '' || path === '--index-file' || path === '--help' || path === '-h') {
      failRead('--index-file に path が必要です')
    }
    indexFile = path
    position += 1
  }
  return indexFile
}

async function resolveIndexFile(cwd: string, repo: string, rawPath: string): Promise<string> {
  const unresolved = isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath)
  const indexFile = await realpath(unresolved).catch(() => failRead(`明示 index を読み取れません: ${unresolved}`))
  const info = await stat(indexFile).catch(() => failRead(`明示 index を読み取れません: ${indexFile}`))
  if (!info.isFile()) failRead(`明示 index は通常ファイルである必要があります: ${indexFile}`)
  const gitDirRaw = (await gitOrFail(repo, null, ['rev-parse', '--absolute-git-dir'])).trim()
  const gitDir = await realpath(gitDirRaw).catch(() => failRead(`current worktree git dir ${gitDirRaw}`))
  const fromGit = relative(gitDir, indexFile)
  if (fromGit.startsWith('..') || isAbsolute(fromGit)) {
    failRead(`明示 index は現在の worktree の Git directory 配下である必要があります: ${indexFile}`)
  }
  return indexFile
}

async function indexBlob(repo: string, indexFile: string | null, path: string): Promise<string | null> {
  try {
    return await git(repo, indexFile, ['show', `:${path}`])
  } catch {
    return null
  }
}

async function headAdrPaths(repo: string): Promise<string[]> {
  try {
    await git(repo, null, ['rev-parse', '--verify', 'HEAD^{commit}'])
  } catch (headError) {
    const headRef = (await git(repo, null, ['symbolic-ref', '--quiet', 'HEAD']).catch(error =>
      failRead(`HEADを確認できません: ${errorMessage(error)}`),
    )).trim()
    const matchingRefs = await git(repo, null, ['for-each-ref', '--format=%(refname)', headRef]).catch(error =>
      failRead(`HEAD参照を確認できません: ${errorMessage(error)}`),
    )
    if (!matchingRefs.split('\n').includes(headRef)) return []
    failRead(`HEADのGit objectを読み取れません: ${errorMessage(headError)}`)
  }
  return (await gitOrFail(repo, null, ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', 'docs/adr'])).split('\0').filter(Boolean)
}

async function gitOrFail(repo: string, indexFile: string | null, args: string[]): Promise<string> {
  return git(repo, indexFile, args).catch(error => failRead(`git ${args[0]}: ${errorMessage(error)}`))
}

async function git(repo: string, indexFile: string | null, args: string[]): Promise<string> {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_')) delete env[key]
  }
  if (indexFile) env.GIT_INDEX_FILE = indexFile
  const child = spawn('git', ['-C', repo, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  const stdout: Buffer[] = []
  const stderr: Buffer[] = []
  child.stdout.on('data', chunk => stdout.push(chunk as Buffer))
  child.stderr.on('data', chunk => stderr.push(chunk as Buffer))
  const code = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', status => resolve(status ?? 1))
  })
  if (code !== 0) throw new Error(Buffer.concat(stderr).toString('utf8').trim() || `git ${args[0]} failed`)
  return Buffer.concat(stdout).toString('utf8')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function finish(issues: Issue[]): never {
  if (issues.length === 0) process.exit(0)
  for (const item of issues) console.error(`${item.code}: ${item.message}`)
  process.exit(1)
}

function failRead(message: string): never {
  console.error(`error: ${message}`)
  process.exit(2)
}
