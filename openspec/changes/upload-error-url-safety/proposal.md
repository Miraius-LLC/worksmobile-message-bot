## Why

添付upload先の署名URLを含むtimeout・通信例外がapp.onErrorへ渡り、500本文とログに署名URLが露出する。

## What Changes

- upload先へのfetch例外をservice境界で固定文言のエラーへ変換する
- 元例外・署名URLを応答やログへ含めない

## Capabilities

### New Capabilities

- `attachment-upload`: upload先の通信例外に対する安全な500応答とログ

## Impact

- `src/services/lineworks/attachment.ts`
- `tests/routes/attachments.test.ts`
- upload先のfetch例外の500本文を固定文言へ変更する
