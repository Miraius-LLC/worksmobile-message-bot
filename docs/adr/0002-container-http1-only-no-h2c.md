# コンテナは HTTP/1.1 のみ、end-to-end h2c 不採用

コンテナは **HTTP/1.1 のみで listen** する。Bun / Node の `node:http2` 単独サーバは HTTP/1.1 を併行受信できず（`allowHTTP1` は ALPN / Upgrade 経由でしか効かない）、Cloud Run の Envoy は素の HTTP/1.1 をコンテナへ投げてくるため、h2c サーバだと protocol error になる。公開側の HTTP/2 は **Cloud Run フロントエンドが終端**し、フロント↔コンテナは HTTP/1.1 で渡る。デプロイに `--use-http2`（`--no-use-http2` を明示）は付けない。webhook サーバなので multiplexing の効果も限定的。

## 検討した代替
- **end-to-end h2c（コンテナまで HTTP/2）**: 上記の通り `node:http2` 単独サーバが Envoy の素の HTTP/1.1 を受けられず protocol error になるため不可。

_出典: CLAUDE.md 注意点（よくあるハマり）/ routes.md HTTP/2, README.md HTTP プロトコル_
