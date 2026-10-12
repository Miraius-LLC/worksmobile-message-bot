## Context

`/callback`はBASIC認証の対象外で、現状は`c.req.text()`が署名検証前に本文全体を読む。

一次情報を2026-10-12に確認した:

- https://developers.worksmobile.com/jp/docs/bot-callback : callbackはイベントを含むJSON、本文をHMAC-SHA256で署名検証する
- https://developers.worksmobile.com/jp/docs/bot-callback-message : 添付イベントはファイル本体ではなく`fileId`を含む

両ページにはcallback本文全体の最大byte数の記載がない。1MiB（1,048,576 byte）は公式上限ではなく、wmbotの独自防御上限である。小さなイベントJSONに余裕を持たせつつ未認証本文のメモリ消費を有限にする値として、Formation司令塔が2026-10-12に承認した。公式の全イベントサイズを保証する値ではなく、上限超過の正規イベントも413になる。

## Decision

上限は`src/routes/callback.ts`の定数1か所に置く。共通Hono routeでWeb標準の`ReadableStream`を読み、各chunkの`byteLength`を加算する。1MiBを超えたchunkはdecode・保持せず、readerをcancelして残りの本文を読まない。上限内はstreaming `TextDecoder`でUTF-8を復元し、既存の署名・Bot ID・dedup・JSON/Zod・転送の順で処理する。

Honoの既存`bodyLimit`は`Content-Length`があり`Transfer-Encoding`がないと申告値だけで判定し、上限内の申告時は実測を省略する。callbackでは申告なし・過少申告でも制限するため、本文の実測を常に行う。runtime固有APIには依存せず、Workers / Cloud Runが共有するappに適用する。

超過時は`413`と`{ error: 'callback body too large' }`を返す。署名不正でも超過が優先され、dedup登録とupstream転送は行わない。

## Verification

HTTP境界で、Content-Lengthなし・過少申告のchunked streamが413となり、残りのchunkを読まずcancelされ、転送されないことを検証する。上限ちょうどの正規UTF-8 callbackはraw bodyと署名を保って200になること、文字数が上限内でもbyte数超過なら413となることを検証する。

## Rollback

bounded readerと413分岐を外して従来の`c.req.text()`に戻し、READMEの上限説明を戻す。未認証本文の無制限な読み取りが再び可能になる。
