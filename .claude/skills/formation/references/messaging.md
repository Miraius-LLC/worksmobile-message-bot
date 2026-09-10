# Formation messaging

Formationの意味契約をtransportの違いから分離する。各送信は保存済みlane attachmentからexact targetを解決し、raw alias、raw pane ID、agent kind、native session IDだけで送信しない。

## Join and route selection

join challengeはownerが選択した全agentのHerdr exact pane targetへだけ送る。challengeは次の鮮度フィールドを持つ一回限りのrecordとする。

```ts
interface FormationJoinChallenge {
  formationId: string
  challengeId: string
  ttlMs: number
  issuedAtEpochMs: number
  expiresAtEpochMs: number
  consumedAtEpochMs: number | null
}
```

発行時にApplication clockから`issuedAtEpochMs`を一度取得してbounded `ttlMs`を加え、`expiresAtEpochMs = issuedAtEpochMs + ttlMs`とする。表示用RFC3339が必要ならこのepoch値からUTC `Z`を導出し、local timezoneやOS固有の`date` optionへ依存しない。発行後にtimestampやTTLを追記・変更せず、訂正が必要なら旧recordを失効させて別`challengeId`を作る。

claimは現epochが`issuedAtEpochMs`以上かつ`expiresAtEpochMs`未満で、`consumedAtEpochMs`がnull、`formationId`が現在のFormationと一致する場合だけ受け付ける。期限切れ、消費済み、旧Formation、時刻不整合のclaimはfail-closedで拒否し、成功したadmitでchallengeを原子的にconsumeする。pane側は`formationId`と`challengeId`だけをdeliveryから受け、agent kind、Herdr workspace / tab / agent / pane ID、repo root、git common dir、head commitは現在の`HERDR_PANE_ID`を起点にCLIが再取得する。native session IDだけは取得不能なら`null`を許す。commander観測値、claim時のfresh facts、contract repository fingerprintが一致した時だけlane attachmentを保存する。これは同一OS user内の誤接続防止であり、敵対的local processへの認証境界ではない。

送達未確認はACK、admitの証拠ではない。busy paneでchallengeが期限切れになっても周期的に再発行せず、まず現在のattachment、同じpane向けの後続challenge、receiptを照合する。後続challengeが既にconsume済みなら古い期限切れ報告は遅延reportとして記録するだけで、新challengeや再ACKを要求しない。まだ未attachでlive challengeも存在しない場合だけ、新しいIDで一件を発行する。

assignment配送はagent kindにかかわらず、保存済みattachmentをfresh照合した`herdr agent prompt`を共通経路とする。native routeはagent名だけで選ばない。

`formation assign --deliver`はassignment eventを先に保存し、live Herdr identityと保存済みactive attachmentが一致した時だけ配送する。送信成功後に送達確認を1行記録する。`formation report`はlane自身のcurrent paneを同じattachmentへfresh照合し、割当scope内のevidenceだけを追記する。

`formation note --deliver`も同じ契約に従う。`FORMATION_NOTE_RECORDED`を先に台帳へ保存し、live Herdr identityと保存済みactive attachmentが一致した時だけ配送し、送信成功後にreceiptを1行記録する。noteはassignment・責任・scopeを変えず、memberへ返信を要求しない。

## Recheck and envelope

送信直前にHerdrのworkspace / tab / pane / agent metadataを再観測し、保存済みattachmentとrepo fingerprintを再照合する。一致しなければ古いrouteへ送らず、release後の再challengeまたはowner判断へ倒す。

配送promptにはFormation・assignment・送信元/受信先laneとbounded summaryを載せ、長い証拠は参照へ分ける。payload hash・attempt・delivery classは配送identityに使わない。commandの異内容再実行拒否は既存command契約に従う。

送達確認は`formationId + kind + itemId + targetChallengeId`ごとの1行だけとする。challengeは自身のID、assignmentとnote（`kind='note'`、itemId = noteId）は保存済みactive attachmentのchallenge IDで配送先を区別する。同じtargetへの記録があれば再送せず、別targetへの送信は既存のauthorityとactive attachment判定に従う。

receipt行の存在はHerdr送信成功の確認であり、memberの受入ではない。ACKはchallenge consumeとassignment terminalから判断する。`CANDIDATE_READY`は成果提出であり、司令塔の`formation ack`までは未ACKとして数える。receipt行がなくても未終端の責任は保持する。

司令塔は同じ配送を並列発行せず、`unconfirmed`や非0終了から自動再送しない。送信成功直後のcrash・記録失敗では、届いていてもreceiptがない。claim/report等の受信側証跡を照合して再送の要否を決め、確認不能なら`BLOCKED`を返す。永続予約を持たないため、並行送信やcrashを跨ぐat-most-onceは保証しない。旧receiptを削除した後も、既存consume/terminalを先に確認して再送を止める。

## Reports and lifecycle signals

long result、diff、ログ、review詳細はrepoまたはartifactへ置き、messageにはbounded summaryとevidence refだけを載せる。作業開始、RED、commit、`BLOCKED`、`CANDIDATE_READY`、`LEAVE_REQUESTED`、handoffは既定のevent kindで報告する。`CANDIDATE_READY`送信後もcommander ACK、independent review、integration acceptanceまで`report_required`である。司令塔発の`NOTE`（`formation note`）はscope訂正・touching拡張・催促の台帳付き補足であり、memberはreportで返さない。noteを読んで迷えば`BLOCKED`を返す。

blocked / timeoutではassignmentと責任を残したままcommanderへcontrol pulseを返す。Herdr idleだけでavailableにしない。exitまたはpane消失はreleaseと同じ回収判定へ収束させ、復帰は新しいlaneへのchallengeで再admitする。graceful leaveとunexpected departureの回収経路を分けず、dirty stateと未共有commitを固定handoff templateで回収する。commanderのexitではauthorityを自動移譲しない。

## CLI authority

実行時のinstalled CLI authorityとversionを再確認してからcommandを選ぶ。少なくとも次のhelpを読み、対象pane、受け付ける引数、receipt境界を確認する。

```text
herdr --help
herdr agent --help
herdr agent prompt --help
codex --help
```

commandはshell文字列を連結せず、確認済みのargvとして組み立てる。Herdr外、target不一致、capability未証明、receipt不明、contract外repoでは送信を続けず、manual baselineまたはowner decisionへ戻す。
