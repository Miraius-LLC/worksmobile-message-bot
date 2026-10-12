## Context

uploadはURL発行とmultipart送信の2段階である。後段のfetch例外が署名URLを含みうる。

## Decision

後段のfetchだけをservice内でcatchし、元例外やcauseを付けず「ファイルのアップロードに失敗しました。」をthrowする。route handlerのtry/catchは追加せずapp.onErrorが500とログを返す。HTTPエラーのstatus透過とURL発行段階は既存挙動を維持する。

## Rollback

本変更commitをrevertする。署名URL漏出が再発するためrollback時はupload利用を止める。
