# Design

`src/utils/config.ts`のconfig読込時に秘密鍵をdecode・形式検証する現行実装を仕様へ反映する。Cloud Runは`src/index.ts`の起動時、Workersは`src/worker.ts`の初回request時にconfigを読み込む。

既存のJWT署名方式と秘密鍵入力contractは維持する。ADR-0003のOriginal Recordは変更せず、その外側へ現在の実装を注記する。コードは変更しない。
