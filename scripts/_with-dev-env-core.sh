# shellcheck shell=sh
# Shared POSIX sh command-resolution logic for with-dev-env entrypoints.
# Sourcing this file only defines the function below.

_with_dev_env_run() {
  if [ "$#" -lt 2 ]; then
    echo "with-dev-env: internal profile arguments are missing" >&2
    return 64
  fi

  _with_dev_env_use_mise=$1
  _with_dev_env_fallback_dir=$2
  shift 2

  if [ "$#" -eq 0 ]; then
    printf 'usage: %s <command> [args...]\n' "$0" >&2
    return 64
  fi

  _with_dev_env_command=$1

  if [ "$_with_dev_env_use_mise" = 1 ] &&
    command -v mise >/dev/null 2>&1; then
    # shellcheck disable=SC2016
    if mise exec -- sh -c 'command -v "$1"' sh "$_with_dev_env_command" >/dev/null 2>&1; then
      exec mise exec -- "$@"
    fi
  fi

  if command -v "$_with_dev_env_command" >/dev/null 2>&1; then
    exec "$@"
  fi

  if [ -n "$_with_dev_env_fallback_dir" ] &&
    [ -x "$_with_dev_env_fallback_dir/$_with_dev_env_command" ]; then
    shift
    exec "$_with_dev_env_fallback_dir/$_with_dev_env_command" "$@"
  fi

  echo "Missing command: $_with_dev_env_command" >&2
  echo "Install mise and run 'mise install', or install $_with_dev_env_command directly." >&2
  return 127
}
