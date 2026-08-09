import { describe, expect, test } from 'bun:test'
import { requireEnv } from '@/test-helpers/utils'
import worker from '@/worker'

const runtimeEnv = {
  CLIENT_ID: requireEnv('CLIENT_ID'),
  CLIENT_SECRET: requireEnv('CLIENT_SECRET'),
  SERVICE_ACCOUNT: requireEnv('SERVICE_ACCOUNT'),
  PRIVATE_KEY: requireEnv('PRIVATE_KEY'),
  BOT_ID: requireEnv('BOT_ID'),
  BASIC_ID: requireEnv('BASIC_ID'),
  BASIC_PASS: requireEnv('BASIC_PASS'),
  BOT_SECRET: requireEnv('BOT_SECRET'),
}

describe('Worker entry', () => {
  test('/healthz は bindings を明示して 200 を返す', async () => {
    const ctx = {
      waitUntil() {},
      passThroughOnException() {},
      props: {},
    }
    const response = await worker.fetch(
      new Request('https://example.test/healthz'),
      runtimeEnv,
      ctx,
    )

    expect(response.status).toBe(200)
  })
})
