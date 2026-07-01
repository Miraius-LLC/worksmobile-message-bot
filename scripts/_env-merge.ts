const MANAGED_HEADER = '# --- 1Password から secrets:dump で生成 (手動編集は次回 dump で上書き) ---'

export function quoteEnvValue(value: string): string {
  if (!value.includes("'")) return `'${value}'`
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$')
    .replaceAll('\n', '\\n')}"`
}

export function mergeEnvContent(existing: string, values: Record<string, string>): string {
  const managedKeys = new Set(Object.keys(values))
  const outputLines: string[] = []
  const lines = existing.replace(/\r\n/g, '\n').split('\n')
  let inManagedBlock = false

  for (const line of lines) {
    if (line === MANAGED_HEADER) {
      inManagedBlock = true
      continue
    }

    if (inManagedBlock) {
      if (line.trim() === '') {
        inManagedBlock = false
      }
      continue
    }

    const key = parseEnvKey(line)
    if (key && managedKeys.has(key)) continue
    outputLines.push(line)
  }

  while (outputLines.at(-1) === '') outputLines.pop()

  if (managedKeys.size > 0) {
    if (outputLines.length > 0) outputLines.push('')
    outputLines.push(MANAGED_HEADER)
    for (const key of [...managedKeys].sort()) {
      outputLines.push(`${key}=${quoteEnvValue(values[key] ?? '')}`)
    }
  }

  return `${outputLines.join('\n')}\n`
}

function parseEnvKey(line: string): string | null {
  const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/)
  return match?.[1] ?? null
}
