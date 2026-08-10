import { describe, expect, test } from 'bun:test'
import { file, Glob } from 'bun'

describe('public repository contract', () => {
  test('.gcloudignoreはGitと全env実体をupload対象外にする', async () => {
    const source = await file(new URL('./.gcloudignore', import.meta.url)).text()
    const patterns = source
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))

    expect(patterns).toContain('.git')
    expect(patterns).toContain('.git/**')
    expect(patterns).toContain('.env')
    expect(patterns).toContain('.env.*')
    expect(patterns.some(pattern => pattern === '!.env.tpl')).toBe(false)
  })

  test('READMEは両基盤を対等なdeploy先として説明する', async () => {
    const readme = await file(new URL('./README.md', import.meta.url)).text()

    expect(readme).toContain('## Cloud Run へのデプロイ')
    expect(readme).toContain('## Cloudflare Workers へのデプロイ')
    expect(readme).toContain('![Cloudflare Workers]')
    expect(readme).toContain('![Google Cloud Run]')
    expect(readme).toContain(
      '同じHono appをCloudflare Workers / Cloud Runのどちらでもデプロイできる。',
    )
    expect(readme).toContain('`WORKER_CUSTOM_DOMAIN`')
    expect(readme).not.toMatch(/主系|待機系|切戻し|社内運用|現在の運用/)
  })

  test('公開設定は環境固有の転送先とidentityをsubstitutionに要求する', async () => {
    const [cloudBuild, monitoring, cloudRunMonitoring] = await Promise.all([
      file(new URL('./cloudbuild.yaml', import.meta.url)).text(),
      file(new URL('./scripts/setup-monitoring.sh', import.meta.url)).text(),
      file(new URL('./scripts/setup-cloud-run-log-monitoring.sh', import.meta.url)).text(),
    ])

    for (const name of ['_SERVICE_ACCOUNT', '_CLIENT_ID', '_SERVICE_ACCOUNT_LW', '_BOT_ID']) {
      expect(cloudBuild).toContain(`[ -n "\${${name}}" ]`)
    }
    expect(cloudBuild).toContain("_FORWARD_CALLBACK_URL: ''")
    expect(cloudBuild).not.toMatch(/scheduler-[0-9]+|@[^\s]+\.iam\.gserviceaccount\.com/)
    expect(monitoring).toContain('PROJECT_ID="$' + '{PROJECT_ID:?Set PROJECT_ID}"')
    expect(monitoring).toContain('SERVICE_HOST="$' + '{SERVICE_HOST:?Set SERVICE_HOST}"')
    expect(monitoring).toContain(
      'NOTIFICATION_CHANNEL_ID="$' + '{NOTIFICATION_CHANNEL_ID:?Set NOTIFICATION_CHANNEL_ID}"',
    )
    expect(monitoring).toContain('gcloud monitoring policies create')
    expect(monitoring).not.toContain('cloud_run_revision')
    expect(monitoring).not.toContain('worksmobile_message_bot_errors')
    expect(monitoring).not.toContain('gcloud alpha')
    expect(monitoring).not.toContain('gcloud beta')
    expect(cloudRunMonitoring).toContain('cloud_run_revision')
    expect(cloudRunMonitoring).toContain('worksmobile_message_bot_errors')
    expect(cloudRunMonitoring).toContain('gcloud monitoring policies create')
    expect(cloudRunMonitoring).not.toContain('gcloud alpha')
    expect(cloudRunMonitoring).not.toContain('gcloud beta')
  })

  test('Cloud Buildはtriggerとmanual buildの両方からsubstitutionを受け取る', async () => {
    const [readme, cloudBuild] = await Promise.all([
      file(new URL('./README.md', import.meta.url)).text(),
      file(new URL('./cloudbuild.yaml', import.meta.url)).text(),
    ])

    expect(readme).toContain('gcloud builds submit . --config=cloudbuild.yaml')
    expect(readme).toContain('git diff --quiet')
    expect(readme).toContain('git diff --cached --quiet')
    expect(readme).toContain('git ls-files --others --exclude-standard')
    expect(readme).toContain('REPO_NAME=$' + '{REPO_NAME}')
    expect(readme).toContain('COMMIT_SHA=$' + '{COMMIT_SHA}')
    expect(readme).toContain('SHORT_SHA=$' + '{SHORT_SHA}')
    expect(cloudBuild).toContain('triggerの設定またはmanual buildの`--substitutions`')
    expect(cloudBuild).not.toContain('Cloud Build trigger substitution(s) missing')
  })

  test('公開docsとdeploy設定は移行時の実測runbookを含まない', async () => {
    const paths = ['README.md', 'TODO.md', 'CHANGELOG.md', 'CONTEXT.md', 'AGENTS.md']
    for await (const path of new Glob('docs/**/*.md').scan({ cwd: import.meta.dir })) {
      paths.push(path)
    }
    paths.push(
      '.env.tpl',
      '.github/workflows/ci.yml',
      'cloudbuild.yaml',
      'wrangler.jsonc',
      'scripts/setup-monitoring.sh',
      'scripts/setup-cloud-run-log-monitoring.sh',
    )
    const source = (
      await Promise.all(paths.map(path => file(new URL(`./${path}`, import.meta.url)).text()))
    ).join('\n')

    expect(source).not.toMatch(/scheduler-[0-9]+|Task [0-9]+|failed run|fallback profile/)
    expect(source).not.toMatch(/Cloudflare Workers.{0,30}(主系|公開先)/)
    expect(source).not.toMatch(/Cloud Run.{0,30}(待機系|障害復旧)/)
  })
})
