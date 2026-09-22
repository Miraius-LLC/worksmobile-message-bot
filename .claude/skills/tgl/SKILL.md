---
name: tgl
description: Use when planning or running TGL multi-agent development, routing implementation and independent reviews, tracking lanes and worktree conflicts, collecting gate evidence, or preparing TGL ship and closeout.
---

# TGL

Triangle-Gated Lead Loop（三角ゲート主任制）。1 lead / 1 lane / 1 worktree / 1 vertical sliceをcommit-readyまで保持する。長い仕事は独立した実装laneへ分担し、設計・final・integrationの独立reviewで手戻りを防ぐ。PLD非依存。

## 最初の判断

- 開始・参加・手動routing前に `agent-room tgl capabilities --repo <repo>`、`tgl status --repo <repo>`、`tgl route --role <role> --mode <read-only|work> --from <agent>`。capability、bridge、稼働lane、touching衝突を確認する。
- `tgl dispatch` / `tgl review` はautoが既定。手動指定はcapability・混雑・path owner・domain上の理由を記録する。model / effortの現在値はrouterとrepoの `docs/agents/runtime.md` を正とする。
- 独立した実装分担が成立するかを `tgl plan` で判断する。長い複数laneを一人で実装してreview待ちへ積まない。分割が不自然なら理由を示してTGLを却下し、単独実装の方針を確認する。
- `rapid_coder` はbounded work限定。sensitive / public-api / schema / migration / permission / deployは除外。final / integrationは独立したClaude/Codexのdeep reviewを必須とし、fast reviewだけで閉じない。
- コマンド実走が要るverifierをshell禁止のread-only profileへ送らない。UI変更では実装と独立したsmokeをprewarmする。

## Formation配下

Formationのcommander↔memberは `formation assign` / `formation report`。通常roomのdelegate / respond / post / sayで置き換えない。TGLはmemberの許可された配下手段であり、assignmentのscope・allowed methods・child concurrencyが上限。

assign前にclaim済みactive attachment、commanderとrecipientの現在のpane / native session / repo照合、scope、実行枠を確認する。通常はCANDIDATE_READYをcommanderがACKして次を配る。CLIが許すsafe_checkpoint先行割当とACKによる責任終端を混同しない。cancelはassignment、releaseはlaneの回収で条件が異なる。

Formationのassign / ACK / cancel / release / Shipperを操作する前は、同梱agent-room-opsの `references/formation-and-owner-operations.md` と各 `--help` を読む。Shipper適格は**検証済みmodern_cliのみ**。TGLのship queueとは別物。Formation内の独立reviewはrepoの `skills/formation/references/review.md`（固定path + sha256）に従う。

## 作業中のhook

- 編集前にlane worktreeの絶対path・touching・検証を示す。別laneやmainを編集せず、scope追加が必要なら報告する。
- 実装dispatchには `tgl dispatch`、final / integrationには `tgl review` を使う。部分失敗時はstatusが示す単一の `dispatch --resume` で回収し、別lane作成や副作用の手動再現をしない。
- dispatchの `run=` 取得直後にstage=dispatch note。no_progress / no_editでは次のdispatch前にstage=working note。shipする場合はverification付きrequestの後にstage=ship note。**これらのnote義務はCLI強制ではない。**
- ready / review前に `tgl lane observe <lane> --worktree <path>` と40文字SHAのheadを照合する。workingは配送状態であり実行証拠ではない。first_edit_at / linked runを確認する。
- acceptanceは番号ごとにtest名・結果を添える。実走できないものをmetにしない。回帰testは修正前や意図的mutationでREDを確認する。
- accepted / adjustedのreview resolve直後に `tgl review prevention`。pending preventionがある場合、次のdispatch / planには安定キーまたは `prevention: none` が必要。

## 必要なときに読む詳細

| 分岐 | 読むreference |
|---|---|
| 設計gate・session開始・role/model選定・AA policy | [start-and-routing](references/start-and-routing.md) |
| 実装分担・境界契約・dispatch/resume・lane観測・UI smoke | [lanes](references/lanes.md) |
| run ID回収・stage note・失敗したworking・予防キー | [evidence](references/evidence.md) |
| final/integration・deep不足・review回収・resolve/prevention | [gates](references/gates.md) |
| ship queue・base前進・proposal・CI/watch・close・shimekukuri・kaizen | [ship-and-close](references/ship-and-close.md) |

ship requestは記録だけでpush / merge / deployではない。baseが進んだら差分分類と再検証を行う。全laneの終端、review/prevention、ship判断、CI/watch、shimekukuri、tgl-kaizenが揃うまでcloseしない。

room操作、Council、管理UI、skill配布はagent-room-opsへroutingする。
