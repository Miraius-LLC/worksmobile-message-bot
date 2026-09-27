/** ADR の構造・採番・索引。archive 照合は別 module に渡す。実行時に repo 外を読まない。 */

import { validateArchive, validateSanitizedArchive } from './_adr-archive-core.ts'

export const ADR_TEMPLATE_RELATIVE_PATH = 'docs/adr/adr-template.md'
export const ADR_TEMPLATE_BASELINE_RELATIVE_PATH = 'scripts/develop-tools/adr-template.md'
export const ADR_CONTRACT_RELATIVE_PATH = 'docs/adr/adr-contract.json'

const LEGACY_CONFIRMATION_MARKER = '移行前原文のSHA-256を照合'
const CONTRACT_KEYS = [
  'schemaVersion',
  'migratedThrough',
  'reservedNumbers',
  'sanitizedNumbers',
] as const

export type Issue = { code: string; message: string }
export type AdrContract = {
  schemaVersion: 1
  migratedThrough: number | null
  reservedNumbers: number[]
  sanitizedNumbers: number[]
}
export type StagedFile = { name: string; content: string }
export type InspectInput = {
  files: StagedFile[]
  /** 検査対象の template 本文。ファイルが無いときは null。 */
  template: string | null
  /** 比較基準。staged では対象 index の template、全体監査では呼び出しが渡す文字列。 */
  baseline: string | null
  readme: string | null
  contract: AdrContract
  fullTree: boolean
}

export function parseAdrContract(
  text: string,
): { ok: true; contract: AdrContract } | { ok: false; message: string } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, message: 'adr-contract.json が JSON ではありません' }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'adr-contract.json は object である必要があります' }
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length !== CONTRACT_KEYS.length || CONTRACT_KEYS.some(key => !keys.includes(key))) {
    return { ok: false, message: 'adr-contract.json のキーが schema と一致しません' }
  }
  if (record.schemaVersion !== 1) {
    return { ok: false, message: 'schemaVersion は 1 である必要があります' }
  }
  const migrated = record.migratedThrough
  if (
    !(
      migrated === null ||
      (typeof migrated === 'number' && Number.isInteger(migrated) && migrated >= 0)
    )
  ) {
    return { ok: false, message: 'migratedThrough は非負整数または null である必要があります' }
  }
  const reserved = numberList(record.reservedNumbers)
  const sanitized = numberList(record.sanitizedNumbers)
  if (!reserved || !sanitized) {
    return {
      ok: false,
      message: 'reservedNumbers と sanitizedNumbers は非負整数の配列である必要があります',
    }
  }
  return {
    ok: true,
    contract: {
      schemaVersion: 1,
      migratedThrough: migrated,
      reservedNumbers: reserved,
      sanitizedNumbers: sanitized,
    },
  }
}

export function inspect(input: InspectInput): Issue[] {
  const issues: Issue[] = []
  if (input.template === null) {
    issues.push(issue('missing-adr-template', `${ADR_TEMPLATE_RELATIVE_PATH} がありません`))
  } else if (input.baseline !== null && input.template !== input.baseline) {
    issues.push(issue('adr-template-drift', `${ADR_TEMPLATE_RELATIVE_PATH} が比較基準と不一致です`))
  }
  return issues.concat(judge(input))
}

export function inspectStaged(input: Omit<InspectInput, 'fullTree'>): Issue[] {
  return judge({ ...input, fullTree: false })
}

function judge(input: InspectInput): Issue[] {
  const issues: Issue[] = []
  const adrFiles = input.files.filter(
    file => file.name !== 'README.md' && file.name !== 'adr-template.md',
  )
  if (!input.fullTree && adrFiles.length === 0) return []
  if (input.readme === null) {
    issues.push(issue('missing-adr-readme', 'docs/adr/README.md がありません'))
  }
  const readme = input.readme ?? ''
  const numbers = new Map<number, string[]>()
  for (const file of adrFiles) {
    const numberText = adrFileNumber(file.name)
    if (!numberText) {
      issues.push(
        issue(
          'invalid-adr-filename',
          `ADR filename が NNNN-kebab-case.md ではありません: ${file.name}`,
        ),
      )
      continue
    }
    const number = Number(numberText)
    const list = numbers.get(number) ?? []
    list.push(file.name)
    numbers.set(number, list)
    if (input.contract.reservedNumbers.includes(number)) {
      issues.push(
        issue(
          'reused-reserved-adr-number',
          `legacy採番時点の欠番は再利用できません: ADR-${numberText}`,
        ),
      )
    }
    if (!validAdrDocument(file.content, numberText)) {
      issues.push(issue('invalid-adr-structure', `新規 ADR が標準構造を満たしません: ${file.name}`))
    }
    const boundary = input.contract.migratedThrough
    const migrated = boundary !== null && number <= boundary
    const valid =
      !migrated ||
      (input.contract.sanitizedNumbers.includes(number)
        ? validateSanitizedArchive(file.content)
        : validateArchive(file.content))
    if (!valid) {
      issues.push(
        issue(
          'invalid-legacy-archive',
          `移行済みADRのOriginal RecordまたはSHA-256が不正です: ${file.name}`,
        ),
      )
    }
    const isNew = boundary === null || number > boundary
    if (isNew) {
      const confirmation = extractConfirmationSection(file.content)
      if (confirmation?.includes(LEGACY_CONFIRMATION_MARKER)) {
        issues.push(
          issue(
            'boilerplate-confirmation',
            `新規 ADR の Confirmation が移行 boilerplate のままです。固有の検証手段 (テスト名 / CI ジョブ / 監査コマンド / 実機手順) を書いてください: ${file.name}`,
          ),
        )
      }
    }
    if (!readme.includes(file.name)) {
      issues.push(
        issue('unindexed-adr', `新規 ADR を README 索引へ1回掲載してください: ${file.name}`),
      )
    }
  }
  for (const [number, files] of [...numbers.entries()].sort((a, b) => a[0] - b[0])) {
    if (files.length > 1) {
      issues.push(
        issue(
          'duplicate-adr-number',
          `ADR-${String(number).padStart(4, '0')} が重複しています: ${files.join(', ')}`,
        ),
      )
    }
  }
  if (input.fullTree) {
    const highest = [...numbers.keys()].reduce<number | null>(
      (max, number) => (max === null || number > max ? number : max),
      null,
    )
    if (highest !== null) {
      for (let number = 1; number <= highest; number += 1) {
        if (!numbers.has(number) && !input.contract.reservedNumbers.includes(number)) {
          issues.push(
            issue(
              'nonsequential-adr-number',
              `新規ADRは連続採番してください: ADR-${String(number).padStart(4, '0')} がありません`,
            ),
          )
        }
      }
    }
  }
  return issues
}

function issue(code: string, message: string): Issue {
  return { code, message }
}

function numberList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const numbers: number[] = []
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) return null
    numbers.push(item)
  }
  return numbers
}

function adrFileNumber(name: string): string | null {
  if (!name.endsWith('.md')) return null
  const stem = name.slice(0, -3)
  const number = stem.slice(0, 4)
  const rest = stem.slice(4)
  if (!/^[0-9]{4}$/.test(number)) return null
  const slug = rest.startsWith('-') ? rest.slice(1) : ''
  if (!slug || slug.split('-').some(word => word.length === 0 || !/^[a-z0-9]+$/.test(word)))
    return null
  return number
}

function validAdrDocument(content: string, number: string): boolean {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const cut = normalized.split('\n').findIndex(line => line.trimEnd() === '## Original Record')
  const standard = cut >= 0 ? normalized.split('\n').slice(0, cut).join('\n') : normalized
  const frontmatter = extractFrontmatter(standard)
  if (!frontmatter) return false
  const status = field(frontmatter, 'status')
  const date = field(frontmatter, 'date')
  if (!status || !validStatus(status) || !date || !validDate(date)) return false
  if (!standard.includes(`# ADR-${number}: `)) return false
  if (hasPlaceholder(stripCode(standard))) return false
  if (
    !standard
      .split('\n')
      .some(line => line.startsWith('Chosen option:') && line.length > 'Chosen option:'.length + 1)
  )
    return false
  for (const consequence of ['Good', 'Bad', 'Neutral']) {
    const prefix = `- ${consequence}:`
    if (
      !standard
        .split('\n')
        .some(line => line.startsWith(prefix) && line.trim().length > prefix.length)
    )
      return false
  }
  return true
}

function extractFrontmatter(content: string): string | null {
  if (!content.startsWith('---\n')) return null
  const rest = content.slice(4)
  const end = rest.indexOf('\n---\n')
  if (end < 0) return null
  return rest.slice(0, end)
}

function field(frontmatter: string, key: string): string | null {
  for (const line of frontmatter.split('\n')) {
    if (line.startsWith(`${key}:`)) return line.slice(key.length + 1).trim()
  }
  return null
}

function validStatus(status: string): boolean {
  if (['proposed', 'accepted', 'rejected', 'deprecated'].includes(status)) return true
  const number = status.startsWith('superseded by ADR-')
    ? status.slice('superseded by ADR-'.length)
    : ''
  return number.length === 4 && /^[0-9]{4}$/.test(number)
}

function validDate(date: string): boolean {
  const parts = date.split('-')
  return (
    parts.length === 3 &&
    parts[0]?.length === 4 &&
    parts[1]?.length === 2 &&
    parts[2]?.length === 2 &&
    parts.every(part => /^[0-9]+$/.test(part))
  )
}

function stripCode(content: string): string {
  const out: string[] = []
  let fence: string | null = null
  for (const line of content.split('\n')) {
    const trimmed = line.trimStart()
    if (fence) {
      if (trimmed.startsWith(fence)) fence = null
    } else if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      fence = trimmed.startsWith('```') ? '```' : '~~~'
    } else {
      out.push(stripInlineCode(line))
    }
  }
  return out.join('\n')
}

function stripInlineCode(line: string): string {
  let out = ''
  let inside = false
  for (const char of line) {
    if (char === '`') {
      inside = !inside
      continue
    }
    if (!inside) out += char
  }
  return out
}

function hasPlaceholder(text: string): boolean {
  let rest = text
  while (rest.includes('{')) {
    const open = rest.indexOf('{')
    const tail = rest.slice(open + 1)
    const end = [...tail].findIndex(char => char === '}' || char === '\n')
    if (end > 0 && tail[end] === '}') return true
    if (end < 0) break
    rest = tail.slice(end)
  }
  return false
}

function extractConfirmationSection(content: string): string | null {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex(line => line.trim() === '### Confirmation')
  if (start < 0) return null
  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) break
    body.push(line)
  }
  return stripHtmlComments(body.join('\n')).trim()
}

function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '')
}
