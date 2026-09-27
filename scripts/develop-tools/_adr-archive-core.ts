/** ADR 本文の中だけを見て、記録された SHA-256 と原文が一致するかを判定する。 */

import { createHash } from 'node:crypto'

export function validateArchive(content: string): boolean {
  return validateArchiveWithMarker(content, 'Legacy source SHA-256', 'Original Record')
}

/** private hash は形式だけを見て、照合するのは public hash と Sanitized Original Record だけ。 */
export function validateSanitizedArchive(content: string): boolean {
  const privateMarker = '<!-- Private legacy source SHA-256: '
  const start = content.indexOf(privateMarker)
  if (start < 0) return false
  const rest = content.slice(start + privateMarker.length)
  const split = splitOnceFlexible(rest, ' -->\n<!-- Public sanitized record SHA-256: ')
  if (!split) return false
  const [privateHash, afterPrivate] = split
  const publicEnd = afterPrivate.indexOf(' -->')
  if (publicEnd < 0) return false
  const publicHash = afterPrivate.slice(0, publicEnd)
  const body = afterPrivate.slice(publicEnd + ' -->'.length)
  if (!isSha256(privateHash) || !isSha256(publicHash)) return false
  const record = stripPrefixFlexible(body, '\n\n## Sanitized Original Record\n\n')
  if (record === null) return false
  return archivedHash(record, publicHash)
}

function validateArchiveWithMarker(content: string, marker: string, heading: string): boolean {
  const needle = `<!-- ${marker}: `
  const start = content.indexOf(needle)
  if (start < 0) return false
  const hashStart = start + needle.length
  const hashEnd = content.indexOf(' -->', hashStart)
  if (hashEnd < 0) return false
  const hash = content.slice(hashStart, hashEnd)
  if (!isSha256(hash)) return false
  const record = recordAfterHeading(content.slice(hashEnd + ' -->'.length), heading)
  if (record === null) return false
  return archivedHash(record, hash)
}

function isSha256(value: string): boolean {
  return value.length === 64 && /^[0-9a-f]+$/i.test(value)
}

function stripPrefixFlexible(text: string, pattern: string): string | null {
  let rest = text
  const parts = pattern.split('\n')
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? ''
    if (index > 0) {
      if (rest.startsWith('\r\n')) rest = rest.slice(2)
      else if (rest.startsWith('\n')) rest = rest.slice(1)
      else return null
    }
    if (!rest.startsWith(part)) return null
    rest = rest.slice(part.length)
  }
  return rest
}

function splitOnceFlexible(text: string, pattern: string): [string, string] | null {
  const head = pattern.split('\n')[0] ?? ''
  let from = 0
  while (from <= text.length) {
    const index = text.indexOf(head, from)
    if (index < 0) return null
    const rest = stripPrefixFlexible(text.slice(index), pattern)
    if (rest !== null) return [text.slice(0, index), rest]
    from = index + head.length
  }
  return null
}

function recordAfterHeading(after: string, heading: string): string | null {
  const target = `## ${heading}`
  let offset = 0
  while (offset < after.length) {
    const rest = after.slice(offset)
    const index = rest.indexOf(target)
    if (index < 0) return null
    const at = offset + index
    const atLineStart = at === 0 || after[at - 1] === '\n'
    if (atLineStart) {
      let tail = after.slice(at + target.length)
      tail = tail.replace(/^[ \t]+/, '')
      const body = stripPrefixFlexible(tail, '\n\n')
      if (body !== null) return body
    }
    offset = at + target.length
  }
  return null
}

function archivedHash(record: string, expected: string): boolean {
  const firstEnd = record.indexOf('\n')
  if (firstEnd < 0) return false
  const first = record.slice(0, firstEnd).replace(/\r$/, '')
  if (!first.endsWith('markdown')) return false
  const fence = first.slice(0, -'markdown'.length)
  if (fence.length < 4 || ![...fence].every(char => char === '~' || char === '`')) return false
  const body = record.slice(firstEnd + 1)
  const crlf = body.lastIndexOf(`\r\n${fence}`)
  const lf = body.lastIndexOf(`\n${fence}`)
  let closeStart = -1
  let closeLen = 0
  if (crlf >= 0) {
    closeStart = crlf
    closeLen = fence.length + 2
  } else if (lf >= 0) {
    closeStart = lf
    closeLen = fence.length + 1
  } else {
    return false
  }
  if (body.slice(closeStart + closeLen).trim() !== '') return false
  const archived = body.slice(0, closeStart)
  const newline = archived.includes('\r\n') ? '\r\n' : '\n'
  return hexDigest(archived) === expected || hexDigest(`${archived}${newline}`) === expected
}

function hexDigest(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
