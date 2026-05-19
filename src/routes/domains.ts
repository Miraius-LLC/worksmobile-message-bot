import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { type AuthenticatedEnv, tokenMiddleware } from '@/routes/_middleware'
import {
  listDomainMembers,
  listDomainMembersQuerySchema,
  registerDomainMember,
  registerDomainMemberSchema,
  unregisterDomainMember,
} from '@/services/lineworks/domain-members'

/**
 * ドメインメンバー (Bot 利用ユーザー) 管理の HTTP ルータ。
 * app.ts で `app.route('/domains', domainsApp)` で mount する。
 *
 * spec パスは `/bots/{botId}/domains/{domainId}/members[/{userId}]` だが、
 * 本サーバーは BOT_ID 固有なので `/domains/:domainId/members[/:userId]` に圧縮している
 */
export const domainsApp = new Hono<AuthenticatedEnv>()

domainsApp.use('*', tokenMiddleware)

/** POST /domains/:domainId/members — Bot 利用ユーザーを 1 件登録 */
domainsApp.post(
  '/:domainId/members',
  zValidator('json', registerDomainMemberSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'リクエスト本文が不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const domainId = c.req.param('domainId')
    const body = c.req.valid('json')
    await registerDomainMember(c.var.token, domainId, body)
    return c.json({ userId: body.userId }, 201)
  },
)

/** GET /domains/:domainId/members — Bot 利用ユーザー一覧 (count/cursor) */
domainsApp.get(
  '/:domainId/members',
  zValidator('query', listDomainMembersQuerySchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'クエリパラメータが不正です'
      return c.json({ error: message }, 400)
    }
  }),
  async c => {
    const domainId = c.req.param('domainId')
    const query = c.req.valid('query')
    const result = await listDomainMembers(c.var.token, domainId, query)
    return c.json(result)
  },
)

/** DELETE /domains/:domainId/members/:userId — Bot 利用ユーザー削除 (idempotent) */
domainsApp.delete('/:domainId/members/:userId', async c => {
  const domainId = c.req.param('domainId')
  const userId = c.req.param('userId')
  await unregisterDomainMember(c.var.token, domainId, userId)
  return c.body(null, 204)
})
