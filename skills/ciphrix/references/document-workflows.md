# Document workflows

Use this guide when configuring document review/approval, selecting recipients, recovering a sent
request or interpreting a workflow result. Installed command help is authoritative for exact options;
the [generated command reference](commands.md) covers the complete command tree.

## Read, configure, send, decide

1. Read the document with `document get --json`. Resolve the intended name, code or ID before writing.
   Workflow readiness describes business state; the server still decides permissions and validates
   prerequisites at execution time.
2. Configure the workflow in draft. Simple supports explicit self-approval; Advanced requires review
   before approval. An approved document needs a new version before editing.
3. Assign recipients using exact active User email or User ID. `user list` supports name/email search
   and pagination; search needs at least three characters. Resolve ambiguous matches with the user.
   People IDs, fuzzy names and invitation requests are not recipient selectors.
4. Send review with `document submit`. Completing review is a separate formal human decision; it
   advances to approval-not-sent without sending approval. A request to send approval does not authorize
   completing review on the user's behalf.
5. Explicitly request approval with `document approval send`. Ordinary approval uses `document approve`;
   `document approval self-approve` is a distinct human decision and never bypasses Advanced review.

Admins and InfoSec leads have tool access. Active employees may receive assignments and complete
review/approval in the app; listing or assigning a user does not grant them tool access. Decisions
record the authenticated caller, not an impersonated assignee.

## Recover a sent request

A sent-recipient setter refuses both a different person and the same person. Explain the current
stage and ask whether the user wants an explicit recall → configure → resend sequence:

| Current request | Recall                     | Configure after recall  | Resend                   |
| --------------- | -------------------------- | ----------------------- | ------------------------ |
| Review sent     | `document review cancel`   | `document reviewer set` | `document submit`        |
| Approval sent   | `document approval cancel` | `document approver set` | `document approval send` |

Recall clears the affected recipient; configure that person again even if unchanged. Removing an
already-cleared assignment is not a recovery step. In supported unsent states, setting the same
recipient succeeds without a change.

Read current state between steps. Each step has independent authorization, confirmation where required
and its own write key. Stop on an error or uncertain result; the sequence is not atomic. Send-back is
a negative human decision, not a synonym for recall. Return-to-draft is available only in the supported
Advanced approval-not-sent/rejected stages and clears assignments and decision attribution.

## Confirmation, retries and results

- Configuration, recipient removal, recall and return-to-draft use confirmed writes. New commands in
  JSON/noninteractive mode require `--yes`; supply it only for an already authorized change.
- New send/decision commands apply immediately, still require human authorization, and reject `--yes`.
  Existing `document submit` and `document approve` retain their advertised options and successful JSON;
  there are no alternate submit/approve spellings. Check each command's help.
- New write commands accept `--idempotency-key` for one logical operation. Reuse the same key and input
  for retries. Confirmed replay also requires valid confirmation: a fresh CLI invocation preflights
  again and can be refused after state changes or expiry. Never use a new key to bypass uncertainty.
- New commands return full envelopes with `--json`, preserving structured errors, warnings and
  pagination. Existing submit success reports `data.status: submitted`, not a current raw workflow
  state. A fresh document read gives current state; a replay returns the original result snapshot.
- Success records the committed/queued outcome. It is not evidence that an email arrived, a recipient
  acted, or the document was published. Report these outcomes separately.

For general operating principles, return to [the Ciphrix skill](../SKILL.md).
