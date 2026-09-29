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

  # Resolution order: PATH, then the profile fallback directory, then 127.
  # Positional parameters: <fallback dir> <command> [args...].
  # The same constant source runs in two places: inside `mise exec` (so mise
  # starts once and the command is resolved in the mise environment) and via
  # eval in this shell when mise is not used. Command names and arguments stay
  # positional parameters and are never spliced into the source.
  #
  # No sentinel exit code is used for "not found in mise": the fallback runs
  # inside the mise process itself, so a command that exits with any status
  # (127 included) is never re-run through another route.
  #
  # Because the mise PATH prepends to the caller PATH, a command that mise
  # cannot resolve is not on the caller PATH either, so the PATH step inside
  # mise covers the former "mise miss, then PATH" route. Differences from the
  # former two-start probe: a profile fallback command reached this way runs
  # with the mise environment, and a failure of mise itself (broken config,
  # failed install) returns mise's status instead of silently using PATH.
  #
  # Nested calls (a with-dev-env child of a mise-exec'd process) still start
  # mise: mise exports no marker that proves the current environment matches
  # the cwd's mise config, so skipping it cannot be decided safely.
  # shellcheck disable=SC2016
  _with_dev_env_resolve='
_with_dev_env_fallback_dir=$1
shift
if command -v "$1" >/dev/null 2>&1; then
  exec "$@"
fi
if [ -n "$_with_dev_env_fallback_dir" ] &&
  [ -x "$_with_dev_env_fallback_dir/$1" ]; then
  _with_dev_env_command=$1
  shift
  exec "$_with_dev_env_fallback_dir/$_with_dev_env_command" "$@"
fi
echo "Missing command: $1" >&2
echo "Install mise and run '\''mise install'\'', or install $1 directly." >&2
exit 127
'

  if [ "$_with_dev_env_use_mise" = 1 ] &&
    command -v mise >/dev/null 2>&1; then
    exec mise exec -- sh -c "$_with_dev_env_resolve" sh \
      "$_with_dev_env_fallback_dir" "$@"
  fi

  set -- "$_with_dev_env_fallback_dir" "$@"
  eval "$_with_dev_env_resolve"
}
