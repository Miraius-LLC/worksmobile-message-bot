import type { ExecutionContext } from 'hono'
import { app } from '@/app'
import { load, type RuntimeEnv } from '@/utils/config'
import { installJapaneseErrorMap } from '@/utils/zod-locale'

installJapaneseErrorMap()

export default {
  async fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
    load(env)
    return await app.fetch(request, env, ctx)
  },
}
