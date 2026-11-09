# LINE WORKS API 更新確認（2026-08-13 以降）

- 確認日: 2026-11-09
- 比較起点: [2026-08-13 の Bot API 差分監査](./lineworks-bot-api-gap-audit-2026-08-13.md)
- 対象実装: `src/services/lineworks/`、`src/routes/`（`origin/develop` の `ca8cfe0`）

## 結論

今回確認できた更新・予告について、**この repository の即時の実装変更は不要**。ただし、2026 年 12 月上旬予定の 1 対 1 トークにおける `join` / `joined` Callback の停止が、転送先の業務処理に影響するかは **owner 判断**。現行実装は `begin` を受け付け、イベント種別で転送を分岐していない。転送先の実装・運用は今回の確認対象外である。

| 公表・更新 | 項目と公式一次情報（2026-11-09 確認） | 判定 | 実装との照合 |
| --- | --- | --- | --- |
| 2026-08-21 | アクセス委任アプリの Private Key は最高管理者のみ管理可能に変更。[公式更新履歴](https://developers.worksmobile.com/jp/news/?lang=ja) | 不要（本 repo の実装） | `src/services/lineworks/auth.ts:31-47` は設定済み秘密鍵で JWT を署名する。キーの管理者権限は Developer Console の操作であり、この署名処理に変更はない。キーの取得・更新を誰が担うかは運用上の確認事項。 |
| 2026-08-28（9月1日追記） | LINE WORKS API 応答の HTTP ヘッダーフィールド名を小文字に変更。[公式更新履歴](https://developers.worksmobile.com/jp/news/?lang=ja)、[公式 Callback 文書の大文字小文字に関する注意](https://developers.worksmobile.com/jp/docs/bot-callback) | 不要 | ダウンロードの `Location` は `Response.headers.get('location')` で読む（`src/services/lineworks/attachment.ts:79-93`）。`fetchWithTimeout` は応答の `Headers` を保持する（`src/services/lineworks/_fetch.ts:110-114`）。ヘッダー名の文字列一致に依存した応答処理は対象実装内で確認されなかった。なお Callback 文書の注意は受信リクエストヘッダーについてで、今回の応答ヘッダー変更とは別の記載である。 |
| 2026-08-28（9月1日追記） | Token 取得を含む Developers 機能の HTTP/1.0 サポート終了。HTTP/1.1 以上を使用。[公式更新履歴](https://developers.worksmobile.com/jp/news/?lang=ja) | 不要 | Bot API と token API の呼び出しは `fetchWithTimeout` → Web `fetch`（`src/services/lineworks/_fetch.ts:62-80`、`src/services/lineworks/auth.ts:60-64`）。実装に HTTP/1.0 固定はない。実際の接続時のプロトコル版を今回の静的調査では測定していない。 |
| 2026-10-16 の予告（2026年12月上旬予定） | Bot と 1 対 1 のトークルームでは `join` / `joined` Callback を発生させず、開始の検知には `begin` を利用する予定。[公式更新履歴](https://developers.worksmobile.com/jp/news/?lang=ja)、[公式 Callback イベント表](https://developers.worksmobile.com/jp/docs/bot-callback) | **owner 判断** | `join` / `joined` / `begin` はいずれも schema に存在する（`src/services/lineworks/callback/schemas.ts:110-139`）。route は種別で分岐せず、検証後の raw body を転送する（`src/routes/callback.ts:109-128`）。`src/services/lineworks/callback/forward.ts:35-49` も種別を変換しない。現在の公式イベント表で 1 対 1 の対象は `message` / `postback` / `begin` / `end` の 4 種。転送先が 1 対 1 の `join` / `joined` を業務上の開始通知として使うかを owner が確認する必要がある。 |
| 2026-10-16 の予告（2026年12月上旬予定） | OIDC の `jwks_uri` から得る公開鍵の `n`（Modulus）末尾のパディング `=` を削除予定。[公式更新履歴](https://developers.worksmobile.com/jp/news/?lang=ja)、[公式 OIDC 文書](https://developers.worksmobile.com/jp/docs/auth-oidc) | 不要 | この repository は Service Account 用 JWT を手元の秘密鍵で生成して token API に渡す（`src/services/lineworks/auth.ts:31-64`）。OIDC の ID Token または JWKS を取得・検証する経路は対象の `src/services/lineworks/`・`src/routes/` にない。 |

`owner 判断` の項目について、この repository 側で仮に 1 対 1 のイベント変換・補完や Callback の HTTP 応答を変更するなら、`src/services/lineworks/callback/` と `src/routes/callback.ts`、関連テストが想定範囲となる。これは callback 連携の観測可能な挙動を変えるため、実装前に OpenSpec active change が必要。転送先だけの変更なら本 repository の HTTP API contract は変わらない。現時点でそのような変更を要求する根拠は確認していない。

## 確認方法と未確認範囲

- [公式ニュース一覧](https://developers.worksmobile.com/jp/news/?lang=ja) の 2026-08-13 より後に掲載された 2026-08-21、08-28（09-01追記）、10-16 の告知を調べ、Bot と API 全般の関連項目を抽出した。[Bot API 一覧](https://developers.worksmobile.com/jp/docs/bot-api) と [Callback 文書](https://developers.worksmobile.com/jp/docs/bot-callback) を現行実装と照合した。対象外サービス（Mail、AiNote、Directory 等）の個別 API は照合していない。
- 公式ニュース一覧は動的ページで、直接取得した HTML から記事本文を読めない場合がある。この調査では公式ドメインの検索インデックスに掲載されたニュース本文と日付を確認した。記事単位の永続 URL と、ニュース一覧の全ページ・全言語の網羅性は確認できていない。したがって掲載漏れがないとは断定しない。
- 公式 Bot API 文書には各ページの変更日・版間 diff がない。2026-08-13 以降に個別ページだけが無告知で変わったかは確認できない。公式ページの現行内容と起点監査の記録・現行コードの比較に限定した。
- 実際の LINE WORKS API 呼び出し、HTTP 接続のプロトコル版、2026 年 12 月以降の Callback 到達状況、転送先のイベント処理は確認していない。予告された変更を実施済みとは扱わない。
