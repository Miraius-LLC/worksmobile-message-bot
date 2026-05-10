import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { buildTraceFields, traceContextMiddleware } from '@/utils/trace'

function makeApp() {
  const app = new Hono()
  app.use('*', traceContextMiddleware)
  app.get('/', c => c.json(buildTraceFields() ?? { none: true }))
  return app
}

describe('utils/trace', () => {
  let originalProject: string | undefined
  beforeEach(() => {
    originalProject = process.env['GOOGLE_CLOUD_PROJECT']
  })
  afterEach(() => {
    if (originalProject === undefined) Reflect.deleteProperty(process.env, 'GOOGLE_CLOUD_PROJECT')
    else process.env['GOOGLE_CLOUD_PROJECT'] = originalProject
  })

  test('ヘッダなし: trace fields は出ない', async () => {
    const res = await makeApp().request('/')
    expect(await res.json()).toEqual({ none: true })
  })

  test('trace + span + GOOGLE_CLOUD_PROJECT: fully-qualified resource name', async () => {
    process.env['GOOGLE_CLOUD_PROJECT'] = 'office-381404'
    const res = await makeApp().request('/', {
      headers: { 'x-cloud-trace-context': 'abc123/span456;o=1' },
    })
    expect(await res.json()).toEqual({
      'logging.googleapis.com/trace': 'projects/office-381404/traces/abc123',
      'logging.googleapis.com/spanId': 'span456',
    })
  })

  test('trace のみ / project なし: trace ID 単独', async () => {
    Reflect.deleteProperty(process.env, 'GOOGLE_CLOUD_PROJECT')
    const res = await makeApp().request('/', {
      headers: { 'x-cloud-trace-context': 'abc123' },
    })
    expect(await res.json()).toEqual({ 'logging.googleapis.com/trace': 'abc123' })
  })

  test('壊れたヘッダ (trace 部分が空) はスキップして trace fields を出さない', async () => {
    const res = await makeApp().request('/', {
      headers: { 'x-cloud-trace-context': '/span456' },
    })
    expect(await res.json()).toEqual({ none: true })
  })

  test('ALS の外で buildTraceFields() を呼ぶと undefined', () => {
    expect(buildTraceFields()).toBeUndefined()
  })
})
