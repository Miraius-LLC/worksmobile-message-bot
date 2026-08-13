import { describe, expect, test } from 'bun:test'
import { createProductionConfig } from './create-wrangler-production-config'

describe('createProductionConfig', () => {
  test('base configへCustom Domain routeを追加する', () => {
    const output = createProductionConfig('{ "name": "worker", // comment\n}', 'bot.example.com')

    expect(JSON.parse(output)).toEqual({
      name: 'worker',
      routes: [{ pattern: 'bot.example.com', custom_domain: true }],
    })
  })

  test('oauthScopeが指定されている場合はvarsに注入する', () => {
    const output = createProductionConfig('{ "name": "worker" }', 'bot.example.com', 'bot.message')

    expect(JSON.parse(output)).toEqual({
      name: 'worker',
      routes: [{ pattern: 'bot.example.com', custom_domain: true }],
      vars: { OAUTH_SCOPE: 'bot.message' },
    })
  })

  test('空のdomainは拒否する', () => {
    expect(() => createProductionConfig('{}', '   ')).toThrow('WORKER_CUSTOM_DOMAIN is required')
  })
})
