import { describe, expect, test } from 'bun:test'

import { pickTargets, toRelatedTestFile } from './run-related-tests'

function existingFiles(...files: string[]): (file: string) => boolean {
  const filesSet = new Set(files)
  return file => filesSet.has(file)
}

describe('toRelatedTestFile', () => {
  test('adds .test before the TypeScript extension', () => {
    expect(toRelatedTestFile('src/foo/bar.ts')).toBe('src/foo/bar.test.ts')
    expect(toRelatedTestFile('src/foo/bar.tsx')).toBe('src/foo/bar.test.tsx')
  })
})

describe('pickTargets', () => {
  test('uses staged test files directly', () => {
    const targets = pickTargets(
      ['src/utils/config.test.ts', 'README.md'],
      existingFiles('src/utils/config.test.ts'),
    )

    expect(targets).toEqual(['src/utils/config.test.ts'])
  })

  test('maps staged source files to existing co-located tests', () => {
    const targets = pickTargets(
      ['src/utils/config.ts', 'src/routes/messages.ts'],
      existingFiles('src/utils/config.ts', 'src/utils/config.test.ts', 'src/routes/messages.ts'),
    )

    expect(targets).toEqual(['src/utils/config.test.ts'])
  })

  test('deduplicates staged files before checking the filesystem', () => {
    const checkedFiles: string[] = []
    const targets = pickTargets(['src/utils/config.ts', 'src/utils/config.ts'], file => {
      checkedFiles.push(file)
      return file === 'src/utils/config.ts' || file === 'src/utils/config.test.ts'
    })

    expect(targets).toEqual(['src/utils/config.test.ts'])
    expect(checkedFiles).toEqual(['src/utils/config.ts', 'src/utils/config.test.ts'])
  })

  test('skips deleted source files and declaration files', () => {
    const targets = pickTargets(
      ['src/utils/deleted.ts', 'src/types/lineworks.d.ts'],
      existingFiles('src/types/lineworks.d.ts', 'src/types/lineworks.d.test.ts'),
    )

    expect(targets).toEqual([])
  })
})
