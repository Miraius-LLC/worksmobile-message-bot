# 送信経路の性能・レイテンシー調査（2026-11-09）

## 結論

`origin/develop` の `12af5f202d95412768ab419b7f1d577aa70a6d02` を対象に、送信側の request 入口から mock LINE WORKS 応答の読了まで測った。通常メッセージと Bot/メニュー一覧は hot token なら upstream 1 回、添付 upload/download は 2 回。cold token では各経路に OAuth 1 回が加わる。16 件同時の cold token 要求は single-flight により OAuth 1 回だった。local 処理の中央値は通常メッセージ 0.116 ms、1 MiB upload 0.518 ms、1 MiB download 0.308 ms。実 API の RTT と本番 cold start は測っていない。

現時点で無条件に実装すべき短縮策は確認できなかった。最も大きい候補は、cold token 取得を request の外へ移すこと。ただし頻度と本番の OAuth RTT が不明なので、下記の条件を満たしてから採否を決める。

## 対象と境界

- 環境: Linux 7.3.3-1-cachyos、AMD Ryzen 9 9955HX、Bun 1.4.4、Hono 4.13.17。専用 worktree で `bun install --frozen-lockfile --ignore-scripts`。実 credential、実 LINE WORKS API、本番 URL は使用しない。
- Hono `app.request` を入口とし、BASIC 認証、`tokenMiddleware`、route、service、mock `fetch`、response 本文の読了まで含む。事前 warmup 5 回を各系列から除外。p50/p95 は計測値の昇順で `ceil(p × n) - 1` 番目。値は ms。loopback socket、TLS、インターネット、Cloud Run/Workers は含まない。
- mock は URL に応じて OAuth、Bot API、upload URL、download URL を返す。1 MiB はゼロ埋め `Uint8Array`。アップロード mock は FormData 本体を読まないので、実際の multipart 送出時間、通信量、peak RSS はこの値から推定できない。download は `Response` 本文を最後まで読む。logger 呼び出しを no-op にして出力 I/O の揺れを抑えた。
- 5 ms/呼び出しの mock 遅延は往復回数の影響を観察する人工条件であり、LINE WORKS の RTT の推定値ではない。系列を固定順で実行したため JIT/GC/他負荷の影響が残り、異なる系列の小差を優劣と断定しない。

## 実測

コマンドは worktree root で `bun run - <<'TS' ... TS`。末尾の「再実行用 harness」が中身で、全 URL を mock に固定する。最初の表はこのコマンドの 1 回の実行結果。upstream は `fetch` 呼び出し回数であり、認証やメッセージの HTTP request 自体の数ではない。

| 経路 / 条件 | 試行回数 | p50 | p95 | upstream / 1 request |
| --- | ---: | ---: | ---: | --- |
| `getServerToken` hot | 100 | 0.000* | 0.007 | 0 |
| `getServerToken` cold | 30 | 0.572 | 0.685 | OAuth 1 |
| text 送信 hot | 100 | 0.116 | 0.241 | message 1 |
| text 送信 cold | 30 | 0.638 | 0.723 | OAuth 1 + message 1 |
| flex 送信 hot | 80 | 0.039 | 0.118 | message 1 |
| 1 MiB 添付 upload hot | 30 | 0.518 | 2.135 | upload URL 発行 1 + 本体 POST 1 |
| 1 MiB 添付 download hot | 30 | 0.308 | 1.497 | 3xx URL 解決 1 + 本体 GET 1 |
| rich menu 一覧 hot | 80 | 0.077 | 0.154 | menu 一覧 1 |
| Bot 一覧 hot | 80 | 0.064 | 0.153 | Bot 一覧 1 |
| text schema の `parse` のみ | 200 | 0.001 | 0.006 | 0 |
| flex schema の `parse` のみ | 200 | 0.001 | 0.011 | 0 |
| `_fetch` 経由の 1 MiB 本文読了 | 80 | 0.205 | 1.829 | mock 本文 1 |

* p50 が表示桁の 0.000 ms 未満。ゼロ時間という意味ではない。

同じ harness の `delay=5` 条件: text hot n=30 は p50/p95 5.222/5.356 ms、upload hot n=20 は 11.286/13.106 ms、download hot n=20 は 10.769/11.889 ms。upstream 回数は上表と同じ。16 同時 cold `getServerToken` は OAuth 合計 1 回（n=16）。追加の `bun run - <<'TS' ... TS` 実行では、text cold + 5 ms/呼び出し n=30 が 11.079/11.700 ms、text hot n=30 が 5.251/5.431 ms。1 MiB 本文を mock から読了する microbench n=100 は、生 `fetch` 0.037/0.879 ms、`fetchWithTimeout` 0.148/1.597 ms（順序固定、差を本番効果へ外挿不可）。

## 経路上の所見

| 箇所 | 現行処理と測定上の含意 |
| --- | --- |
| `src/routes/_middleware.ts:16`、`src/services/lineworks/auth.ts:89` | token は request ごとに確認するが、fresh cache は upstream 0。残り 60 秒未満では `isFresh` が false となり同期更新。`auth.ts:101-118` の single-flight は同時 16 件で OAuth 1 回を確認した。初回・更新時は request が OAuth を待つ。JWT の `aud` は `auth.ts:8,39` で固定。 |
| `src/services/lineworks/_fetch.ts:62-120` | 各 fetch に timeout と response body を包む stream を付け、本文読了/cancel まで timer を維持する。1 MiB mock 読了 0.205 ms p50。生 fetch 比は同一 mock の別実行で約 0.111 ms p50 差。ただし body 中 timeout と cancel 伝播を失う変更は不適。 |
| `src/services/lineworks/api.ts:62-106` | メッセージは JSON stringify → 1 POST → 成功時も `response.text()` と JSON parse 試行 → 結果を捨てる。mock の空本文では追加の upstream はない。実成功本文の大きさが不明で、parse 省略の効果は実証していない。 |
| `src/routes/messages.ts:24-44`、`src/services/lineworks/messages/index.ts:384-422` | 13 type × channel/user を登録し、型ごとの Zod 検証後に汎用 dispatcher が 1 POST。text/flex の schema 単体中央値は約 0.001 ms。これを外す効果は示せず、入力不変条件と ADR-0007 を損なう。 |
| `src/routes/attachments/upload.ts:8-17`、`src/services/lineworks/attachment.ts:16-67` | `parseBody()` で `File` を作り、発行 API と multipart POST の 2 往復。10 MiB 制限は `src/routes/attachments/index.ts:17`。1 MiB mock は本体を消費しないため multipart の実メモリと送出時間は未測定。発行を省くと fileId/uploadUrl が得られない。 |
| `src/services/lineworks/attachment.ts:75-110`、`src/routes/attachments/download.ts:11-76` | `redirect: 'manual'` で 3xx `Location` を取得し、署名 URL を再 fetch、本文を stream で返す。2 往復。応答 header 時点で return せず、計測では client 相当の本文読了まで含めた。3xx を自動追従させると認証・エラー処理と署名 URL の扱いが変わる。 |
| `src/routes/menus/rich.ts:63-72`、`src/services/lineworks/menus/rich.ts:181-209`、`src/routes/bots.ts:63-68`、`src/services/lineworks/bots-tenant.ts:171-195` | 一覧は query 検証、URL 組み立て、1 GET、JSON parse。1 page/request。cursor による次 page は別 request であり、全件のページ数・本番応答時間は未測定。固定メニュー取得は `src/routes/menus/persistent.ts:39-43` から 1 GET。 |

## 提案（短縮できる実時間の大きい順）

1. **条件付き: token 更新を request の外へ移す設計を検討する。** 対象 `src/services/lineworks/auth.ts:89-118`、`src/routes/_middleware.ts:16-18`。cold text は local で hot より p50 0.522 ms 長く、人工的に OAuth と message に各 5 ms 入れると 11.079 対 5.251 ms（差 5.828 ms）。本番の効果は cold request 比率 × OAuth RTT に依存し、現状不明。まず request duration と token cache hit/miss/refresh 待ちを秘密を出さずに計測し、p95 に cold が実際に寄与すると判明した場合だけ、期限前の背景更新と失敗時の同期再取得を検討する。測定方法は同一負荷下の A/B で request p50/p95、OAuth 回数、401、更新失敗後の回復を比較する。壊れうる不変条件: AGENTS.md の JWT `aud` 固定・Base64 PEM・scope、`getServerToken` cache/single-flight、ADR-0003。request の外での更新は複数 instance/isolates での余分な OAuth 呼び出しや expiry race を増やしうる。**本調査は実装推奨の判定を保留する。**

`_fetch` の stream 包装、Zod 検証、upload の URL 発行、download の 3xx 手順は削除案にしない。前者は本文中 timeout、検証は API contract、後二者は LINE WORKS の手順に必要であり、安全に減らせる呼び出しを確認できなかった。`api.ts:90-96` の成功本文 parse 省略も実成功本文の大きさと短縮効果を測れていないため提案しない。

## local から分からないこと

- LINE WORKS OAuth / Bot API / upload URL / download URL の RTT、応答 body サイズ、HTTP keep-alive/TLS、429 等の実分布: 実 API と credential を使わない条件のため未測定。5 ms mock は実値ではない。
- Cloud Run/Workers の cold start、instance 間 cache、負荷時の CPU/GC と network contention: `app.request` の単一 Bun process では再現していない。`auth.ts` の cache は process 内だけ。
- 10 MiB multipart の peak RSS と実送出時間、download 実ファイルの backpressure: mock は upload 本体を読まず、download はメモリ上の 1 MiB `Response`。従ってこの調査値を production memory 要件には使わない。

## 再実行用 harness

以下を worktree root で実行する。出力は JSON 行。実行前に env や `.env` を読まず、生成した test RSA key と mock のみ使う。`bun install --frozen-lockfile --ignore-scripts` 済みを前提とする。

```sh
bun run - <<'TS'
import { generateKeyPairSync } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { app } from '@/app'
import { load } from '@/utils/config'
import { logger } from '@/utils/logger'
import { _resetTokenCacheForTest, getServerToken } from '@/services/lineworks/auth'
import { messageSchemas } from '@/services/lineworks/messages'
import { fetchWithTimeout } from '@/services/lineworks/_fetch'
for (const k of ['request', 'success', 'warn', 'error', 'failure', 'info', 'debug']) {
  if (typeof (logger as any)[k] === 'function') (logger as any)[k] = () => {}
}
const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
load({ CLIENT_ID: 'bench', CLIENT_SECRET: 'bench', SERVICE_ACCOUNT: 'bench', PRIVATE_KEY: Buffer.from(pem).toString('base64'), BOT_ID: 'bench', BASIC_ID: 'bench', BASIC_PASS: 'bench', BOT_SECRET: 'bench' })
const auth = 'Basic ' + Buffer.from('bench:bench').toString('base64')
const bytes = new Uint8Array(1024 * 1024)
let calls: string[] = []
let delay = 0
globalThis.fetch = (async (url: string | URL) => {
  const u = String(url)
  const kind = u.includes('auth.worksmobile.com') ? 'auth' : u.includes('upload.mock') ? 'upload' : u.includes('download.mock') ? 'body' : u.includes('/attachments/F1') ? 'resolve' : u.includes('/attachments') ? 'issue' : u.includes('/richmenu') ? 'menu' : u.endsWith('/bots') ? 'bots' : 'message'
  calls.push(kind)
  if (delay) await new Promise(resolve => setTimeout(resolve, delay))
  if (kind === 'auth') return Response.json({ access_token: 'mock-token', expires_in: 86400 })
  if (kind === 'issue') return Response.json({ uploadUrl: 'https://upload.mock/file', fileId: 'F1' })
  if (kind === 'resolve') return new Response(null, { status: 302, headers: { location: 'https://download.mock/file' } })
  if (kind === 'body') return new Response(bytes)
  if (kind === 'bots') return Response.json({ bots: [] })
  if (kind === 'menu') return Response.json({ richmenus: [] })
  return new Response(null, { status: 200 })
}) as typeof fetch
function percentile(xs: number[], p: number) { const a = [...xs].sort((x, y) => x - y); return a[Math.ceil(p * a.length) - 1].toFixed(3) }
async function run(name: string, n: number, fn: () => Promise<unknown>, cold = false) {
  const ms: number[] = []; const counts: Record<string, number> = {}
  for (let i = 0; i < n + 5; i++) {
    if (cold) _resetTokenCacheForTest()
    calls = []
    const start = performance.now()
    await fn()
    if (i >= 5) { ms.push(performance.now() - start); for (const c of calls) counts[c] = (counts[c] ?? 0) + 1 }
  }
  console.log(JSON.stringify({ name, n, p50_ms: percentile(ms, .5), p95_ms: percentile(ms, .95), upstream_per_request: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / n])) }))
}
async function req(path: string, method = 'GET', body?: BodyInit, contentType?: string) {
  const headers: Record<string, string> = { authorization: auth }
  if (contentType) headers['content-type'] = contentType
  const response = await app.request(path, { method, headers, body })
  if (!response.ok) throw new Error(path + ' ' + response.status)
  await response.arrayBuffer()
}
const text = () => req('/channels/C1/messages/type/text', 'POST', JSON.stringify({ text: 'hello' }), 'application/json')
const flex = () => req('/users/U1/messages/type/flex', 'POST', JSON.stringify({ altText: 'hello', contents: { type: 'bubble' } }), 'application/json')
const upload = () => { const form = new FormData(); form.append('file', new Blob([bytes]), 'f.bin'); return req('/attachments', 'POST', form) }
await run('token_hot', 100, () => getServerToken())
await run('token_cold', 30, () => getServerToken(), true)
await run('text_hot', 100, text)
await run('text_cold', 30, text, true)
await run('flex_hot', 80, flex)
await run('upload_1MiB_hot', 30, upload)
await run('download_1MiB_hot', 30, () => req('/attachments/F1'))
await run('rich_menu_list_hot', 80, () => req('/menus/rich'))
await run('bot_list_hot', 80, () => req('/bots'))
await run('schema_text_parse', 200, async () => { messageSchemas.text.parse({ text: 'hello' }) })
await run('schema_flex_parse', 200, async () => { messageSchemas.flex.parse({ altText: 'hello', contents: { type: 'bubble' } }) })
await run('fetch_body_1MiB', 80, async () => { const response = await fetchWithTimeout('https://download.mock/file'); await response.arrayBuffer() })
delay = 5
await run('text_hot_mock_5ms_per_fetch', 30, text)
await run('upload_hot_mock_5ms_per_fetch', 20, upload)
await run('download_hot_mock_5ms_per_fetch', 20, () => req('/attachments/F1'))
_resetTokenCacheForTest(); calls = []
await Promise.all(Array.from({ length: 16 }, () => getServerToken()))
console.log(JSON.stringify({ name: 'token_16_concurrent', n: 16, upstream_total: calls.reduce((a, c) => (a[c] = (a[c] ?? 0) + 1, a), {} as Record<string, number>) }))
TS
```

追加系列は同じ mock の `delay=5` で cold/hot text を各 30 回、1 MiB `Response` 本文を `fetch`/`fetchWithTimeout` で各 100 回読了した。固定順の比較なので再現時は実行順も記録し、採否判断には交互順の A/B と本番計測が要る。
