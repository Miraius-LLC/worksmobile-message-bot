# 受信 callback と起動の性能調査（2026-11-09）

## 結論

ローカルの正常 callback は p50 0.182 ms、p95 0.245 ms（1,000 回、同一ホストの HTTP upstream）だった。そのうち転送単体は p50 0.129 ms、p95 0.173 ms。署名・Bot ID・JSON/Zod の各処理はマイクロ秒級で、今回の実測では変更を正当化する律速ではない。10,000 件を保持した dedup Map の毎回の全走査は p95 0.585 ms に増えたが、実際の Map 件数は未計測なので本番の問題とは判定しない。同期転送を非同期化する提案はしない（[ADR-0004](../adr/0004-callback-dedup-in-memory-5min.md)、[ADR-0005](../adr/0005-forward-callback-to-upstream.md) の失敗通知と手動再投入の契約を変えるため）。

Cloud Run 用 bundle は 272,659 B、Bun build 済みエントリのプロセス起動から `/healthz` 応答までは p50 66.07 ms、p95 70.67 ms。Docker image の実サイズはコンテナ build 用 CLI がないため未測定。Workers の Wrangler dry-run bundle は 1,008,740 B（upload 表示 985.10 KiB、gzip 167.54 KiB）。これはローカルの bundle と起動であり、本番 cold start ではない。

## 測定境界と再現方法

- 対象: `origin/develop` の `12af5f202d95412768ab419b7f1d577aa70a6d02`。Linux x86_64、AMD Ryzen 9 9955HX、Bun 1.4.4、Wrangler 4.158.0。専用 worktree で計測し、実 LINE WORKS API、本番 URL、実 credential は使っていない。
- `bun install --frozen-lockfile` の後、`NODE_ENV=production bun - <<'JS' ... JS` で一時的な標準入力スクリプトを実行。各系列を 100～200 回 warmup してから、`performance.now()` で各操作の `await` を含む経過時間を測った。昇順配列の `floor(n*0.50)` と `floor(n*0.95)` を報告。試験値のみを `config.load()` に渡し、`fetch` は mock または `Bun.serve({hostname:'127.0.0.1',port:0})` で置換した。production の pino は `warn` 未満をフィルタするため、request/info の出力 I/O はこの値に含まれない（[logger-impl.ts](../../src/utils/logger-impl.ts) 81–95, 100–115 行）。
- callback の fixture は `tests/routes/callback.test.ts` の message event 形状。`issuedTime` を毎回変え、dedup の重複短絡を避けた。署名は試験用 `test-secret` の HMAC-SHA256。正常 route は `app.request('/callback', ...)`、ローカル upstream は body を読み 204 を返した。測定点は呼出し開始から `Response` 取得までで、実 TCP 接続と Bun/Hono のコストを含む。転送単体のローカル HTTP は 200 と本文 `ok` を返し、`forwardEventToUpstream` の body cancel を含めた。
- 個別段階は `verifyCallbackSignature`、`verifyBotId`、`buildDedupKey`、`checkAndRegister`、`JSON.parse`、`callbackEventSchema.safeParse`、`forwardEventToUpstream` を直接呼んだ。本文読込は非公開の `readCallbackBody` と同じ `Request.body.getReader()` → byte 加算 → `TextDecoder` → `join` を 1 chunk で実行した**等価操作の推定値**で、route 内の厳密な計時ではない。middleware は Hono の同一 GET handler に `traceContextMiddleware` → `requestLogMiddleware` → `secureHeaders()` → `basicAuth()` を順次積んだ累積値。`x-cloud-trace-context` と正しい試験用 Basic ヘッダを渡した。差分は独立した段階の厳密値ではなく目安。
- 再実行の要点: `NODE_ENV=production bun -` の標準入力で上記 fixture と試験用 `config.load` を用意し、各操作を `for` で指定回数実行する。route 全体のローカル upstream は `Bun.serve({port:0,fetch: async req => { await req.text(); return new Response('', {status:204}) }})`、転送単体は `new Response('ok', {status:200})` とし、`FORWARD_CALLBACK_URL` を `http://127.0.0.1:${server.port}/callback` にする。mock は `globalThis.fetch = async () => new Response('ok')` とし、終了時に元へ戻す。dedup の 10,000 件条件は `checkAndRegister(String(i), 0)` を 10,000 回行い、全件を未失効にしてから新規 key を `checkAndRegister(key, 0)` で 1,000 回検査・解除する。空 Map 条件も同じ `now=0` で毎回登録後に `unregister` する。route 全体の成功 key は 1,000 回の間 Map に残るため、空 Map の定常値ではない。

### callback 各段（ms）

| 段階・実行コマンド内の操作 | 試行 | p50 | p95 | 対応箇所 |
|---|---:|---:|---:|---|
| 1 chunk 本文読込の等価操作 | 2,000 | 0.00250 | 0.00870 | `src/routes/callback.ts:17-40` |
| 署名 `verifyCallbackSignature(raw,sig,secret)` | 10,000 | 0.00068 | 0.00238 | `src/routes/callback.ts:65` |
| Bot ID `verifyBotId(id,id)` | 10,000 | 0.00006 | 0.00007 | `src/routes/callback.ts:74` |
| SHA-256 `buildDedupKey(raw)` | 10,000 | 0.00037 | 0.00087 | `src/routes/callback.ts:90` |
| dedup 検査・登録、空 Map | 10,000 | 0.00014 | 0.00032 | `src/services/lineworks/callback/dedup.ts:36-42` |
| dedup 検査・登録、未失効 10,000 件 | 1,000 | 0.03926 | 0.58546 | 同上、特に `:13-17` |
| `JSON.parse(raw)` | 10,000 | 0.00018 | 0.00020 | `src/routes/callback.ts:101` |
| `callbackEventSchema.safeParse(payload)` | 10,000 | 0.00033 | 0.00128 | `src/routes/callback.ts:109` |
| `forwardEventToUpstream(raw,sig)`、即時 mock 2xx・空 body | 1,000 | 0.00333 | 0.00942 | `src/routes/callback.ts:121` |
| 同関数、即時 mock 200・本文 `ok` と cancel | 1,000 | 0.00360 | 0.01120 | `src/services/lineworks/callback/forward.ts:101-110` |
| 同関数、同一ホスト HTTP upstream 200・本文 `ok` と cancel | 1,000 | 0.1290 | 0.1725 | `src/services/lineworks/callback/forward.ts:35-50,101-110` |
| callback route 全体、同一ホスト HTTP upstream 204 | 1,000 | 0.1816 | 0.2446 | `src/routes/callback.ts:60-129` |

`fetchWithTimeout` の mock abort は `timeoutMs:5` で 100 回、p50 5.0994 ms、p95 5.1516 ms。実既定は 15,000 ms（`src/services/lineworks/_fetch.ts:17,64-77`）。この試験はタイマーと abort 変換が動くことを示すだけで、実 upstream の失敗時間やタイムアウト時の本文停止時間を表さない。成功時は `forward.ts:109-110` が未使用本文を cancel し、ラッパがタイマーを解除する（`_fetch.ts:102-105`）。body cancel を省く変更は提案しない。

### middleware の累積値（ms）

同じ試験 request で各 2,000 回。個別費用の目安は隣接行の p50 差で、非線形な相互作用を含む。

| 積んだ middleware | p50 | p95 | 隣接 p50 差 |
|---|---:|---:|---:|
| Hono handler のみ | 0.00063 | 0.00155 | — |
| + trace (`src/app.ts:54`) | 0.00128 | 0.00474 | 0.00065 |
| + request log (`src/app.ts:58`) | 0.00149 | 0.00585 | 0.00021 |
| + secure headers (`src/app.ts:61`) | 0.00279 | 0.01077 | 0.00130 |
| + BASIC (`src/app.ts:67-70`) | 0.01873 | 0.05431 | 0.01594 |

`/callback` は `PUBLIC_PATHS` により BASIC 認証を通らない（`src/app.ts:29,67-70`）。BASIC の累積値は非公開 route 用。trace、request log、secure headers は callback にも適用される。pino の production level は `warn` なので本測定の request log はフィルタされる。開発モードや実ログ sink の I/O 費用には外挿しない。

### 起動・配布サイズ

| 対象 | コマンド・条件 | 試行 | 結果 |
|---|---|---:|---|
| Cloud Run 用 Bun bundle | `bun run build`; `wc -c build/index.js` | 1 build | 272,659 B（200 modules、build 26 ms） |
| build 済み `src/index.ts` のローカル起動 | 試験 env のみで `bun build/index.js` を `Bun.spawn` し、空きポートの `/healthz` が 200 になるまで 1 ms 間隔で fetch | 30 process | p50 66.07 ms、p95 70.67 ms（61.67–70.81 ms） |
| Workers source module load | 新規 `bun -e` process ごとに `import('./src/worker.ts')` | 30 process | p50 64.232 ms、p95 70.540 ms |
| Workers 最初の request | 上記直後に試験 env で `worker.fetch(Request('/healthz'),env,ctx)` | 30 process | p50 7.396 ms、p95 8.406 ms |
| Workers bundle | `bunx wrangler deploy --dry-run --outdir .wrangler/perf-inbound-bundle`; `wc -c .wrangler/perf-inbound-bundle/worker.js` | 1 build | 1,008,740 B、Wrangler 表示 985.10 KiB / gzip 167.54 KiB |
| Docker image | `Dockerfile` の multi-stage runtime image | 0 | **実サイズ未測定**。この環境には Docker / Podman / Buildah / nerdctl / skopeo / crane がなく image を build できない。bundle サイズを image サイズと取り違えない。 |

起動の 30 回は子 process に試験用 env だけを渡した。Workers の Bun import は Cloudflare isolate の初回 load と同一ではない。`worker.ts:9-11` の `load(env)` は初回に Zod parse し、以後は cache hit になる。Cloud Run の runtime は `Dockerfile:31-57` の `oven/bun:1.4.4-slim`、tzdata、ca-certificates を含むため、272,659 B の JS bundle が image 容量ではない。

## 提案（実時間の効果順、採用条件付き）

今回のローカル実測だけで直ちに採用すべき source 変更はない。次の順で追加データを取り、条件を満たしたものだけ別 change として扱う。

1. **同期 upstream 待ちの実測を先に取る。** 対象 `src/routes/callback.ts:120-128`、`src/services/lineworks/callback/forward.ts:35-50`。ローカル転送単体 p50 0.129 ms は route 全体 p50 0.182 ms の大部分を占める。実 upstream 待ちがこれを大きく超えるなら、その実時間が改善余地の上限となる。まず upstream 側と gateway 側の同一 request の時刻を突合し、p50/p95 と timeout・失敗率を取る。実応答時間が分かるまで設定値短縮や転送方式変更はしない。守る条件は [ADR-0005](../adr/0005-forward-callback-to-upstream.md) の同期 200/500、raw body と署名の保持、[ADR-0004](../adr/0004-callback-dedup-in-memory-5min.md) の失敗時 unregister。fire-and-forget は失敗を黙らせるため採らない。
2. **dedup Map の件数が大きい場合だけ掃除頻度を検討する。** 対象 `src/services/lineworks/callback/dedup.ts:13-17,36-42`。10,000 件では空 Map に対し p50 約 0.039 ms、p95 約 0.585 ms の差を観測した。現実の Map 件数・callback 率を観測し、その条件で全走査を間引いた比較を行う。期待効果の上限は当該条件で上記の全走査時間程度。5 分 TTL、重複副作用の回避、失敗時 unregister、instance/isolate ごとの best effort という [ADR-0004](../adr/0004-callback-dedup-in-memory-5min.md) の条件を壊してはならない。10,000 件が現実に生じないなら実装しない。

BASIC 認証を外すとローカルの非公開 route で p50 約 0.016 ms は縮むが、`AGENTS.md` の MUST と [ADR-0006](../adr/0006-basic-auth-except-health-and-callback.md) の認証境界を壊すので提案から除外する。trace や secure headers の数 µs も同様に外さない。`logger.request` の production フィルタ変更も、今回の計測では I/O 効果を示せていない。

## ローカルでは測れない値

LINE WORKS 側の発信から gateway 到達まで、実 upstream の応答時間、Cloud Run の本番 cold start と image サイズ、Cloudflare Workers isolate の初回起動時間は**未測定**。ネットワーク経路、負荷、CPU 割当、ランタイム基盤が異なるため上記のローカル値から推測値を数値化しない。image サイズだけは build CLI 不在が直接の障害であり、利用可能なコンテナ build 環境で `docker build` と `docker image inspect --format '{{.Size}}'` を行えば取得できる。実 LINE WORKS API や本番 credential を使う計測はこの調査の範囲外。
