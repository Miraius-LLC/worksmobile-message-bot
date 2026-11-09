# Bun / Hono リリースノート調査（2026-11-09）

調査日: 2026-11-09（UTC の公開日時を日付として表示）

## 調査範囲と一次情報

- Bun: 1.4.0 以降の安定版。Bun 公式 Blog と GitHub Releases を照合した。公式一覧では 1.4.4 が最新で、1.4.5 以降の安定版は確認できなかった。
- Hono: 2026-08-09 以降の `honojs/hono` 本体（安定版と RC）、`honojs/node-server`、`honojs/middleware` の `@hono/zod-validator` の GitHub Releases を確認した。別 package の adapter tag は対象外。
- GHSA: 上記 3 リポジトリの公式 Security advisories API/一覧を確認した。期間内に公開されたものを列挙する。

## Bun 1.4.x

| 版 | 公開日 | 公式リリースノート |
|---|---|---|
| 1.4.0 | 2026-08-20 | [Bun 1.4](https://bun.com/blog/bun-v1.4), [GitHub Release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.0) |
| 1.4.1 | 2026-09-04 | [Bun v1.4.1](https://bun.com/blog/bun-v1.4.1), [GitHub Release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.1) |
| 1.4.2 | 2026-09-05 | [Bun v1.4.2](https://bun.com/blog/bun-v1.4.2), [GitHub Release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2) |
| 1.4.3 | 2026-10-10 | [Bun v1.4.3](https://bun.com/blog/bun-v1.4.3), [GitHub Release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.3) |
| 1.4.4 | 2026-10-22 | [Bun v1.4.4](https://bun.com/blog/bun-v1.4.4), [GitHub Release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4) |

### repo への関連がある変更（詳細なコード照合は下記の判定表）

- 1.4.0: Bun 1.4 の新機能・互換性修正。リリースノートは `bun test --parallel` などを含む大規模更新で、通常の `bun test` / `bun --check` / Hono HTTP 起動に直接の移行指示はない。
- 1.4.1: `fetch()` の TLS 検証、`localhost` 解決、HTTP/Node 互換性、`Bun.serve` の安定性修正。Docker/HTTP サーバー運用に影響し得るため、現行の起動経路を確認する。
- 1.4.2: 1.4.1 回帰（Elysia の build 変数衝突、AsyncLocalStorage、worker_threads）、musl の GC クラッシュ等を修正。Alpine/musl を採用していない場合は直接影響を確認できない。
- 1.4.3: `bun check` を追加（TypeScript 型チェック用途）、`bun test`/`bun build`/`bun run` の `--check`、`Bun.FetchSession`、Node HTTP 性能・互換性、`Bun.serve` 修正。既存の `bun --check` 利用との関係は判定表で扱う。
- 1.4.4: `bun fmt`、`bun check` 高速化、Yarn Berry lockfile 移行、インストールの指数バックオフ、JavaScriptCore 更新、`Bun.SQL` 等。既存 repo は Yarn lockfile 移行や `bun fmt` を使っていないため、直接の必須対応はない。

## Hono コアのリリース（2026-08-09 以降）

`honojs/hono` の公式 Releases API で公開日が 2026-08-09 以降のタグを抽出した。コア版は 16 件、Hono 5 の候補版 2 件である。

| 版 | 公開日 | 主な変更（リリース本文の要約） | 公式 URL |
|---|---|---|---|
| 4.13.2 | 2026-08-13 | `secure-headers` の Permissions-Policy、ETag、Cookie、CORS、JSON body の修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.2) |
| 4.13.3 | 2026-08-18 | URL/client、ETag、CORS、router、CSRF、IPv6、`pretty-json` の修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.3) |
| 4.13.4 | 2026-08-24 | request/router、ETag、client、Cookie、stream の修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.4) |
| 4.13.5 | 2026-08-26 | GHSA 3件（fragment 後の query、`toSSG` path traversal、`parseBody({ dot: true })` memory exhaustion） | [Release](https://github.com/honojs/hono/releases/tag/v4.13.5) |
| 4.13.6 | 2026-09-04 | client WebSocket URL、型、handler iteration の修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.6) |
| 4.13.7 | 2026-09-04 | JSX 境界コンポーネントの plain string XSS（GHSA-hxh3-vqpv-xpqv）修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.7) |
| 4.13.8 | 2026-09-15 | JSX、Accept/Language、AWS Lambda streaming、request body cache の修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.8) |
| 4.13.9 | 2026-09-24 | JSX、Accept、router、JWT base64url、AWS adapter の修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.9) |
| 4.13.10 | 2026-09-28 | runtime adapter を別 package として公開（`@hono/bun` 等）、adapter import は v5 で削除予定 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.10) |
| 4.13.11 | 2026-09-29 | `serveStatic` 二重 decode の middleware bypass（GHSA-5r4p-p66f-jhc7）。`@hono/node-server` v2.1.3 にも修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.11) |
| 4.13.12 | 2026-09-30 | bundled d.ts、ETag、JSX、`some()` middleware の修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.12) |
| 4.13.13 | 2026-10-04 | `hono/mount` の追加、`app.mount()` 非推奨（v5 で削除予定） | [Release](https://github.com/honojs/hono/releases/tag/v4.13.13) |
| 4.13.14 | 2026-10-25 | `serveStatic` GET/HEAD、router、CSS/JSX、Accept-Encoding 等の修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.14) |
| 4.13.15 | 2026-11-01 | `WWW-Authenticate` realm の backslash escape、response body 消費後の `c.header()` | [Release](https://github.com/honojs/hono/releases/tag/v4.13.15) |
| 4.13.16 | 2026-11-01 | GHSA 5件（mount、RegExpRouter wildcard、form validator、CSS helper、CSRF ping）および JWT 検証修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.16) |
| 4.13.17 | 2026-11-07 | Cookie prefix、query key、ETag、client、timing、MIME、JSX/CSP、SSG、AWS header の修正 | [Release](https://github.com/honojs/hono/releases/tag/v4.13.17) |
| 5.0.0-rc.0 | 2026-10-08 | Hono 5 候補版（リリース本文に詳細なし） | [Release](https://github.com/honojs/hono/releases/tag/v5.0.0-rc.0) |
| 5.0.0-rc.1 | 2026-10-10 | Hono 5 候補版（リリース本文に詳細なし） | [Release](https://github.com/honojs/hono/releases/tag/v5.0.0-rc.1) |

## `@hono/node-server` のリリース（2026-08-09 以降）

| 版 | 公開日 | 主な変更 | 公式 URL |
|---|---|---|---|
| 2.1.1 | 2026-08-14 | request header の遅延 materialize | [Release](https://github.com/honojs/node-server/releases/tag/v2.1.1) |
| 2.1.2 | 2026-09-29 | HTTP/2 abort、serve static、early hints、header mutation、body read の修正 | [Release](https://github.com/honojs/node-server/releases/tag/v2.1.2) |
| 2.1.3 | 2026-09-29 | `serveStatic` 二重 decode の middleware bypass（GHSA-rmxm-3fg6-px4f） | [Release](https://github.com/honojs/node-server/releases/tag/v2.1.3) |
| 2.1.4 | 2026-10-08 | Hono v5 を peer dependency として許可 | [Release](https://github.com/honojs/node-server/releases/tag/v2.1.4) |
| 2.1.5 | 2026-10-13 | HTTP/2 reset 時の request signal abort、GET/HEAD のみ serve static | [Release](https://github.com/honojs/node-server/releases/tag/v2.1.5) |
| 2.1.6 | 2026-11-02 | raw backslash path、WebSocket `//` host/origin、async upgrade ECONNRESET の GHSA 3件 | [Release](https://github.com/honojs/node-server/releases/tag/v2.1.6) |
| 1.19.18 | 2026-11-02 | raw backslash path（GHSA-jpvv-r467-5p4w）。2.x の同修正から WebSocket 修正を除いたもの | [Release](https://github.com/honojs/node-server/releases/tag/v1.19.18) |

## GHSA（Hono）

`honojs/hono` の公式 Security advisories のうち、公開日が 2026-08-09 以降のものは 10 件。

| GHSA | 公開日 | 概要 | 修正版 |
|---|---|---|---|
| [GHSA-crvj-82cr-hjcx](https://github.com/honojs/hono/security/advisories/GHSA-crvj-82cr-hjcx) | 2026-08-26 | URL fragment 後の query を読む cache/proxy interpretation differential | 4.13.5 |
| [GHSA-gqvv-2mrq-wpjv](https://github.com/honojs/hono/security/advisories/GHSA-gqvv-2mrq-wpjv) | 2026-08-26 | `toSSG()` の output directory 外書込み（CVE-2026-39408 の不完全修正） | 4.13.5 |
| [GHSA-g6gw-c38x-mqfc](https://github.com/honojs/hono/security/advisories/GHSA-g6gw-c38x-mqfc) | 2026-08-26 | `parseBody({ dot: true })` の無制限 dot-notation nesting による memory exhaustion | 4.13.5 |
| [GHSA-hxh3-vqpv-xpqv](https://github.com/honojs/hono/security/advisories/GHSA-hxh3-vqpv-xpqv) | 2026-09-04 | JSX boundary component の plain string XSS | 4.13.7 |
| [GHSA-5r4p-p66f-jhc7](https://github.com/honojs/hono/security/advisories/GHSA-5r4p-p66f-jhc7) | 2026-09-29 | `serveStatic` 二重 decode による middleware bypass | 4.13.11 |
| [GHSA-3gg2-335m-rxc6](https://github.com/honojs/hono/security/advisories/GHSA-3gg2-335m-rxc6) | 2026-11-01 | CSS helper の closing tag 組立による HTML injection | 4.13.16 |
| [GHSA-h7mg-cq63-vhpq](https://github.com/honojs/hono/security/advisories/GHSA-h7mg-cq63-vhpq) | 2026-11-01 | RegExpRouter の wildcard middleware bypass | 4.13.16 |
| [GHSA-4m76-xfj5-7975](https://github.com/honojs/hono/security/advisories/GHSA-4m76-xfj5-7975) | 2026-11-01 | `mount()`/`app.mount()` の path-scoped middleware bypass | 4.13.16 |
| [GHSA-4h7h-rv7c-7m2v](https://github.com/honojs/hono/security/advisories/GHSA-4h7h-rv7c-7m2v) | 2026-11-01 | `validator('form')` が multipart extra parameter 付きで validation を skip | 4.13.16 |
| [GHSA-46wx-v44x-9hh2](https://github.com/honojs/hono/security/advisories/GHSA-46wx-v44x-9hh2) | 2026-11-01 | `csrf()` が hyperlink auditing の `text/ping` を検査しない | 4.13.16 |

## GHSA（`@hono/node-server`）

期間内に公開されたものは 4 件。

| GHSA | 公開日 | 概要 | 修正版 |
|---|---|---|---|
| [GHSA-rmxm-3fg6-px4f](https://github.com/honojs/node-server/security/advisories/GHSA-rmxm-3fg6-px4f) | 2026-09-29 | `serveStatic` 二重 decode による middleware bypass | 2.1.3 |
| [GHSA-qv5m-9pm6-hqp3](https://github.com/honojs/node-server/security/advisories/GHSA-qv5m-9pm6-hqp3) | 2026-11-02 | async WebSocket upgrade 中の未処理 ECONNRESET による process crash | 2.1.6 |
| [GHSA-7v5p-43qr-wch5](https://github.com/honojs/node-server/security/advisories/GHSA-7v5p-43qr-wch5) | 2026-11-02 | WebSocket request-target `//` による host/origin check bypass | 2.1.6 |
| [GHSA-jpvv-r467-5p4w](https://github.com/honojs/node-server/security/advisories/GHSA-jpvv-r467-5p4w) | 2026-11-02 | raw backslash の path separator 解釈による reverse proxy access control bypass | 2.1.6 / 1.19.18 |

## `@hono/zod-validator`

`honojs/middleware` に独立した package release tag がある。期間内は以下の 1 件。`honojs/middleware` の Security advisories API では期間内の公開 GHSA は 0 件。

| 版 | 公開日 | 主な変更 | 公式 URL |
|---|---|---|---|
| 0.9.1 | 2026-08-31 | validator middleware 作成時に、大文字小文字を区別しない header schema metadata を cache する | [Release](https://github.com/honojs/middleware/releases/tag/%40hono/zod-validator%400.9.1) |

## 確認できなかった範囲

- 2026-08-09 から調査日までの公式 GitHub Releases API と公式ブログを確認した。Bun 1.4.5 以降の安定版、Hono 4.13.18 以降のコア版、`@hono/node-server` 2.1.7 以降の公開は確認できない。
- Hono の 5.0.0 RC のリリース本文は詳細がないため、4.x との互換差分をこの調査だけでは確定できない。

## 現行 repo の対応判定

### 対応すべき

現時点で追加対応はない。Bun の最新安定版は 1.4.4 で、`Dockerfile:14` と `.config/mise.toml:2` は一致する。Hono 4.13.17、`@hono/node-server` 2.1.6、`@hono/zod-validator` 0.9.1 は `package.json:39-41` と `bun.lock:121,123,333` に固定解決され、確認した GHSA の修正版以上である。したがって **Bun の新しい安定版へ上げる価値の判定は対象版なし**。将来の版が公開された場合は、その時点の変更と実測で再判定する。

### 不要（現行版に反映済み、または使用していない）

| 変更・懸念 | この repo での判定とコード根拠 |
|---|---|
| Bun 1.4.3 の `bun check` 導入、1.4.4 の型検査修正 | `package.json:26` が既に `bun --check` を使い、`package.json:25,36` は通常の `bun test` を使う。`bunfig.toml:5` の preload も現行構成。1.4.4 を使用しており、オプションの追加は必須でない。 |
| Bun の build/HTTP/Node 互換修正 | `package.json:24` の `--target=bun --minify` で build し、`Dockerfile:17,23,28,31,57` の build/runtime 両方が 1.4.4。`src/index.ts:20,40-51` は `@hono/node-server` の `serve()` と `server.close()` を使う。対象版の修正を既に含むため移行作業は不要。 |
| Hono の `secure-headers`、BASIC 認証、wildcard router（GHSA-h7mg-cq63-vhpq） | `src/app.ts:61,67-70` は `app.use('*')` で header と BASIC 認証を適用するため、wildcard bypass は重要な照合対象。ただし修正版 4.13.16 より新しい 4.13.17 に解決済み（`bun.lock:333`）。回避用 router への切替は不要。 |
| Hono の query parser（GHSA-crvj-82cr-hjcx） | `src/routes/bots.ts:64` などは `zValidator('query')` を使う。修正版 4.13.5 より新しい 4.13.17 に解決済み（`bun.lock:333`）。 |
| Hono の `parseBody({ dot: true })`（GHSA-g6gw-c38x-mqfc） | `src/routes/attachments/upload.ts:9` は引数なしの `parseBody()` で、dot-notation を有効化していない。`src/routes/attachments/index.ts:17-24` の 10 MB bodyLimit は別の制限であり、GHSA の対策と取り違えない。現行 Hono も修正版以上。 |
| Hono の form validator（GHSA-4h7h-rv7c-7m2v） | `src/routes/messages.ts:28`、`src/routes/bots.ts:50,64` などの `zValidator` は `json` または `query`。添付は `src/routes/attachments/upload.ts:9-12` で `parseBody()` 後に `File` を検査する。`validator('form')` を使用せず、現行 Hono も修正版以上。 |
| Hono の `mount()`、JSX/CSS、CSRF、SSG、static 関連 GHSA | `src/app.ts:79-86` は `app.route()` で mount し、`app.mount()` や `hono/mount` は使わない。JSX/CSS、`csrf()`、`toSSG()`、`serveStatic()` も現行 source にない。修正版以上であり追加対応不要。 |
| `@hono/node-server` の GHSA 4 件と 2.1.x 修正 | `src/index.ts:20,40-51` は `serve()` と graceful shutdown のみ。WebSocket upgrade/静的配信は使わず、raw backslash path の修正も 2.1.6 に含まれる（`bun.lock:121`）。`src/worker.ts:8-12` は別の Workers entry で、この Node adapter を経由しない。 |
| `@hono/zod-validator` 0.9.1 | `src/routes/bots.ts:50,64` 等で利用。現行 lock は 0.9.1（`bun.lock:123`）。期間内の release は header schema metadata の cache 修正で、呼び出し API の移行指示はない。 |
| Hono `onError` と HTTPException | `src/app.ts:90-107` は `HTTPException.getResponse()` を透過し、その他を 500 にする。今回のノートに、この実装へ必須の API 変更はない。 |

### 藤井さんの判断

Hono 5.0.0 RC を先行評価するかは藤井さんの判断事項。4.13.17 が最新の安定版であり、今回の GHSA には対応済みなので、安定版公開を待つことを勧める。先行評価する場合の変更範囲は `package.json` / `bun.lock`、`src/app.ts`、各 route の `zValidator`、`src/index.ts`、`src/worker.ts` と関連テスト。依存更新だけで外部 contract が変わらなければ OpenSpec 不要、HTTP/認証/validation の観測可能な挙動を変えるなら実装前に OpenSpec active change が必要（`docs/conventions/documentation.md:22-39`）。
