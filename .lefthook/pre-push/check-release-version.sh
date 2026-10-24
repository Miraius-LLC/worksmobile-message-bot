#!/bin/sh
# develop-sync が配る lefthook の pre-push 本文。手で書き換えない。
for name in $(env | sed -n 's/^\(GIT_[A-Za-z0-9_]*\)=.*/\1/p'); do unset "$name"; done
exec .develop-tools/resolve pre-push check-release-version --pre-push
