# Handoffs

Handoff は停止中の仕事を安全に再開するための要点だけを記録する。保存先は対象 repo の handoffs/ とし、同じ内容を複数の横断文書へ複製しない。

## Frontmatter

    ---
    status: open | resolved
    date: <YYYY-MM-DD>
    resolved_commit: <fill when resolved>
    ---

- receiver がまだ action を取る必要がある間は status: open。
- work が landed し、着地点の SHA が確認できてから status: resolved と resolved_commit を記入する。
- resolved handoff は削除しない。
- 既存 handoff の本文を移動・編集しない。古い handoff の frontmatter は、次にそのファイルを扱う時にだけ追加する。

本文は goal / 現状 / 完了済み / 未解決 / 次の安全な行動 / 関連 evidence を短く記す。handoff を受けたら記載内容を現行 status、assignment ID、branch と照合し、矛盾があれば古い記述で作業を再開しない。
