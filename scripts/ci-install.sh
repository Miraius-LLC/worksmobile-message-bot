#!/usr/bin/env bash
# CI 用 bun install ラッパー。
#
# **CI では install 時の Socket Security Scanner を使わない。**
#
# 理由: scanner 1.1.3 は組織の Socket Security Policy を参照せず、クライアント側の
# 固定テーブル (dist/index.js の publicPolicy) で alert の action を決める。そこに
# ["licenseSpdxDisj", "warn"] が含まれ、bun は warn を「CI では即 exit」として扱う
# (https://bun.com/docs/install/security-scanner-api)。licenseSpdxDisj は SPDX 式に
# 選言があるというライセンス表記の指摘で、間接依存によくある。結果として check / deploy
# が必ず赤くなる。socket.dev 側でその alert を Monitor へ下げても 1.1.3 には効かない
# (2026-09-23 実測)。
#
# **root の bunfig.toml は変えていない。** 開発者の手元では scanner がそのまま効く。
# 外したのは CI の install だけ。
#
# 撤去条件: https://github.com/SocketDev/bun-security-scanner/issues/33 が解決し、
# 組織ポリシーが反映されるようになったら、このラッパーを捨てて素の bun install に戻す。
set -eu

repoRoot="$(cd "$(dirname "$0")/.." && pwd)"
noScannerConfig="${repoRoot}/.github/bunfig.ci-no-scanner.toml"

if [ ! -f "$noScannerConfig" ]; then
  echo "::error::${noScannerConfig} が無い。CI の install は scanner 無し設定を要求する。" >&2
  exit 1
fi

exec bun install --config="$noScannerConfig" "$@"
