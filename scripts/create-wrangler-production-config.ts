import { file, JSONC, write } from 'bun'

export function createProductionConfig(source: string, customDomain: string): string {
  const domain = customDomain.trim()
  if (!domain) {
    throw new Error('WORKER_CUSTOM_DOMAIN is required')
  }

  const config = JSONC.parse(source) as Record<string, unknown>
  config.routes = [{ pattern: domain, custom_domain: true }]
  return JSON.stringify(config, null, 2)
}

if (import.meta.main) {
  const source = await file('wrangler.jsonc').text()
  const output = createProductionConfig(source, process.env.WORKER_CUSTOM_DOMAIN ?? '')

  await write('wrangler.production.json', output)
}
