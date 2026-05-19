import { mock } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'

// `.env` の NODE_ENV が test 実行時に紛れ込むのを防ぐ。Bun の `.env` 自動ロードは
// preload より先に走るため、ここで上書きすれば `.env` 側の値は無視される。
// NODE_ENV ごとの挙動を見るテストでは test 内で上書き → afterEach で 'test' に戻す。
process.env['NODE_ENV'] = 'test'

// production の `src/index.ts` 起動シーケンス (`config.load()` → JWT 署名 → API 呼び出し)
// をテストでも再現できるよう、必須 env を本物の RSA 鍵で埋める。CI 等で実 env が
// 入っていればそれを尊重し、欠けているものだけテスト用フィクスチャで補う。
function setupFixtureEnv() {
  const needsKey = !process.env['PRIVATE_KEY']
  if (needsKey) {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
    process.env['PRIVATE_KEY'] = Buffer.from(pem).toString('base64')
  }
  process.env['CLIENT_ID'] ??= 'test-client-id'
  process.env['CLIENT_SECRET'] ??= 'test-client-secret'
  process.env['SERVICE_ACCOUNT'] ??= 'test-sa@example.com'
  process.env['BOT_ID'] ??= 'test-bot-id'
  // BASIC_ID / BASIC_PASS は `.env` の実値 (本番 credentials) が混ざるとテストの
  // 固定 Authorization ヘッダと食い違って 401 になるため、NODE_ENV と同じく強制上書きする
  process.env['BASIC_ID'] = 'test-user'
  process.env['BASIC_PASS'] = 'test-pass'
  // BOT_SECRET も同様に固定 (Callback 署名検証テストで HMAC を組み立てるため決定論的に)
  process.env['BOT_SECRET'] = 'test-bot-secret'
}
setupFixtureEnv()

// pino のログを丸ごと黙らせる。テストでは error 経路を通るため
// 出力が冗長になりすぎるのを防ぐ。実装が呼んだことだけ確認したい場合は
// この mock を test 内で再度 `mock.module('@/utils/logger', ...)` で上書きする。
const noop = () => {}
mock.module('@/utils/logger', () => ({
  logger: {
    failure: noop,
    error: noop,
    warn: noop,
    info: noop,
    success: noop,
    request: noop,
    debug: noop,
  },
  withDuration: async <T>(action: () => Promise<T>) => action(),
}))

// Zod の日本語エラーマップと config.load() を実行 (production の index.ts 起動順)。
// `mock.module` 設定後に評価する必要があるため動的 import。
const { installJapaneseErrorMap } = await import('@/utils/zod-locale')
installJapaneseErrorMap()

const { load: loadConfig } = await import('@/utils/config')
loadConfig()
