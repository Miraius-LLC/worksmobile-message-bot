import { describe, expect, test } from 'bun:test'
import { mergeEnvContent, quoteEnvValue } from './_env-merge'

describe('quoteEnvValue', () => {
  test('通常の secret 値は single quote で囲む', () => {
    expect(quoteEnvValue('abc$def')).toBe("'abc$def'")
  })

  test('single quote を含む値は double quote で安全に逃がす', () => {
    expect(quoteEnvValue('a$b"c\nd\\e\'f')).toBe('"a\\$b\\"c\\nd\\\\e\'f"')
  })
})

describe('mergeEnvContent', () => {
  test('既存コメントと未管理キーを残し、管理キーだけ置き換える', () => {
    const out = mergeEnvContent(
      ['# local', 'CLIENT_ID=old', 'PORT=8080', '', '# tail', ''].join('\n'),
      { CLIENT_ID: 'new-client', BOT_SECRET: 'secret' },
    )

    expect(out).toContain('# local')
    expect(out).toContain('PORT=8080')
    expect(out).toContain('# tail')
    expect(out).not.toContain('CLIENT_ID=old')
    expect(out).toContain('# --- 1Password から secrets:dump で生成')
    expect(out).toContain("BOT_SECRET='secret'")
    expect(out).toContain("CLIENT_ID='new-client'")
  })

  test('既存の管理ブロックは丸ごと置き換える', () => {
    const out = mergeEnvContent(
      [
        'PORT=8080',
        '',
        '# --- 1Password から secrets:dump で生成 (手動編集は次回 dump で上書き) ---',
        "CLIENT_ID='old'",
        '',
        'LOG_PRETTY=1',
      ].join('\n'),
      { CLIENT_ID: 'new' },
    )

    expect(out).toContain('PORT=8080')
    expect(out).toContain('LOG_PRETTY=1')
    expect(out).not.toContain('old')
    expect(out).toContain("CLIENT_ID='new'")
  })
})
