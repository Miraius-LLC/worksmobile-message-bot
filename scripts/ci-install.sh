#!/usr/bin/env bash
# CI 用 bun install ラッパー。
#
# Socket Security Scanner の障害で install が落ち、check / deploy が同時に赤くなる事故が
# 2026-08-27 に発生した (unknown certificate verification error)。
# scanner 由来の失敗だけをリトライし、それでも復旧しない場合は push (deploy) に限り
# scanner 無しの bunfig で install する。
# pull_request など push 以外は迂回せず落とす (lockfile が変わりうる経路のため)。
#
# scanner 以外の失敗 (lockfile 不整合など) は 1 回目で即座に伝播させる。
# 本物の失敗をリトライで薄めない。
set -eu

maxAttempts=3
fallbackConfig="./.github/bunfig.ci-no-scanner.toml"
# リトライ間隔。テストから 0 を渡して待たずに分岐だけ検証する。
retrySleep="${CI_INSTALL_RETRY_SLEEP:-5}"

isScannerFailure() {
  printf '%s\n' "$1" | grep -q -e 'ScannerFailed' -e 'Security scanner failed' -e 'Socket Security Scanner'
}

attempt=1
while [ "$attempt" -le "$maxAttempts" ]; do
  set +e
  output="$(bun install "$@" 2>&1)"
  statusCode=$?
  set -e
  printf '%s\n' "$output"

  if [ "$statusCode" -eq 0 ]; then
    exit 0
  fi

  if ! isScannerFailure "$output"; then
    exit "$statusCode"
  fi

  if [ "$attempt" -eq 1 ] && [ -n "${SOCKET_API_KEY:-}" ]; then
    echo "::warning::Socket authenticated scan failed; retrying without SOCKET_API_KEY."
    unset SOCKET_API_KEY
  else
    echo "::warning::Socket scanner failed (attempt ${attempt}/${maxAttempts}); retrying."
    # set -e 下では `[ ... ] && sleep` が false のときにスクリプトごと終了するので if で書く。
    if [ "$retrySleep" -gt 0 ]; then
      sleep "$((attempt * retrySleep))"
    fi
  fi

  attempt=$((attempt + 1))
done

# 迂回を許すのは push (deploy) だけ。workflow_dispatch や未設定 (ローカル実行) は許可しない。
if [ "${GITHUB_EVENT_NAME:-}" != "push" ]; then
  echo "::error::Socket scanner unavailable. event=${GITHUB_EVENT_NAME:-unset} では scanner を迂回しない。"
  exit 1
fi

echo "::warning::Socket scanner unavailable after ${maxAttempts} attempts; installing with ${fallbackConfig} (commit 済み lockfile をそのまま使用)."
bun --config="$fallbackConfig" install "$@"
