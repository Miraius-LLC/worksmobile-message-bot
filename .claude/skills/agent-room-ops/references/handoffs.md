# Handoff文書

## Handoff Documents

Handoff notes live in `~/Develop/.agent-room/<repo>/handoffs/`. **A resolved handoff must look
different from an open one.** Without that, a reader has to read the whole document to learn
whether the work is still waiting (2026-09-07: a resolved handoff was indistinguishable from an
open one, and the resolution was hand-written at the end of the body).

Start every handoff with YAML frontmatter:

```yaml
---
status: open          # open | resolved
date: 2026-09-07      # when the handoff was written
resolved_commit:      # fill in when status becomes resolved; leave empty while open
---
```

Rules:

- `status: open` while the receiving side still has to act. `resolved` only after the work landed.
- When you resolve it, set `status: resolved` **and** put the landing SHA in `resolved_commit`.
  A resolution without a SHA is not resolvable back to what actually shipped.
- Do not delete a resolved handoff. The frontmatter is what makes it skippable.
- Keep the body as it is. The frontmatter is the index; the body is the record.

To list what is still open:

```bash
rg -l '^status: open$' ~/Develop/.agent-room/<repo>/handoffs/
```

Existing handoffs written before this rule have no frontmatter. Add it when you next touch one;
do not sweep them all at once.
