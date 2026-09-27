#!/usr/bin/env bun
/** working tree の docs/adr を、同じ判定 module で全体監査する。 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  ADR_CONTRACT_RELATIVE_PATH,
  ADR_TEMPLATE_BASELINE_RELATIVE_PATH,
  ADR_TEMPLATE_RELATIVE_PATH,
  inspect,
  parseAdrContract,
  type StagedFile,
} from './_adr-standard-core.ts'

const root = process.cwd()
const adrDir = join(root, 'docs/adr')
let names: string[]
try {
  names = (await readdir(adrDir)).filter(
    name => name.endsWith('.md') && name !== 'README.md' && name !== 'adr-template.md',
  )
} catch {
  fail('docs/adr がありません')
}
names.sort()
const contractPath = join(root, ADR_CONTRACT_RELATIVE_PATH)
const templatePath = join(root, ADR_TEMPLATE_RELATIVE_PATH)
const baselinePath = join(root, ADR_TEMPLATE_BASELINE_RELATIVE_PATH)
const contractText = await readFile(contractPath, 'utf8').catch(() =>
  fail(`${ADR_CONTRACT_RELATIVE_PATH} がありません`),
)
const parsed = parseAdrContract(contractText)
if (!parsed.ok) fail(parsed.message)
const template = await readFile(templatePath, 'utf8').catch(() => null)
const baseline = await readFile(baselinePath, 'utf8').catch(() =>
  fail(`${ADR_TEMPLATE_BASELINE_RELATIVE_PATH} がありません`),
)
const readme = await readFile(join(adrDir, 'README.md'), 'utf8').catch(() => null)
const files: StagedFile[] = []
for (const name of names) {
  files.push({ name, content: await readFile(join(adrDir, name), 'utf8') })
}
const issues = inspect({
  files,
  template,
  baseline,
  readme,
  contract: parsed.contract,
  fullTree: true,
})
if (issues.length === 0) process.exit(0)
for (const item of issues) console.error(`${item.code}: ${item.message}`)
process.exit(1)

function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(2)
}
