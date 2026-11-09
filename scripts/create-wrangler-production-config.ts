import { file, JSONC, write } from 'bun'

export function createProductionConfig(
  source: string,
  customDomain: string,
  oauthScope?: string,
): string {
  const domain = customDomain.trim()
  if (!domain) {
    throw new Error('WORKER_CUSTOM_DOMAIN is required')
  }

  const config = JSONC.parse(source) as Record<string, unknown>
  // The generated config lives at the repository root, unlike its source.
  if (config.$schema === '../node_modules/wrangler/config-schema.json') {
    config.$schema = 'node_modules/wrangler/config-schema.json'
  }
  if (config.main === '../src/worker.ts') {
    config.main = 'src/worker.ts'
  }
  config.routes = [{ pattern: domain, custom_domain: true }]
  if (oauthScope) {
    const existingVars = (config.vars as Record<string, unknown> | undefined) ?? {}
    config.vars = { ...existingVars, OAUTH_SCOPE: oauthScope }
  }
  return JSON.stringify(config, null, 2)
}

if (import.meta.main) {
  const source = await file('.config/wrangler.jsonc').text()
  const output = createProductionConfig(
    source,
    process.env.WORKER_CUSTOM_DOMAIN ?? '',
    process.env.OAUTH_SCOPE,
  )

  await write('wrangler.production.json', output)
}
