---
name: ciphrix
description: Operate a Ciphrix compliance programme with the `ciphrix` CLI. Use when an agent needs to understand or change a tenant's business context, documents, frameworks, controls, tests and evidence, risks, vendors, assets, monitoring checks, or background jobs.
---

# Ciphrix

Ciphrix is an AI-native compliance automation platform. A tenant's compliance programme lives in one
place: how the organization operates, the documents it publishes, the frameworks it has adopted, the
tests those frameworks impose, the evidence gathered against those tests, and the risks, vendors, assets
and monitoring checks around them. AI does the heavy lifting — generating drafts, reading evidence,
judging relevance — but every formal decision stays with a human.

You are operating that programme through `ciphrix`. You resolve things by **name or code**, you act on
**intents**, and you report what actually happened — including when nothing did.

## Operating stance

Ciphrix treats compliance as a living model of how an organization operates, not a checklist assembled
for an audit. Context explains the organization; documents state how it intends to operate; frameworks,
clauses and controls express obligations and design; tests ask whether those claims hold; evidence and
monitoring show what actually happened; risks, vendors and assets connect that assurance to the real
business. Preserve those relationships when you work.

Apply these principles:

- **Reality before paperwork.** Start from the organization's actual context and current records. Do not
  manufacture a polished compliance story that is unsupported by the system.
- **Evidence before assertion.** Treat evidence, monitoring results and recorded decisions as distinct
  facts. A document saying that a control exists is not proof that it operated, and an AI assessment is
  not a human decision.
- **Assistance without invented authority.** Help people understand, draft, organise and execute their
  intent. Do not approve, attest, accept risk, record a test result or make another formal decision unless
  the user clearly asked for that decision.
- **The API is the source of truth.** Never infer access, state or success from expectations. Report the
  result returned by Ciphrix, preserve distinctions such as `not found`, `not permitted`, `pending` and
  `not assessed`, and never work around authorization.
- **Small, attributable changes.** Read the relevant record before changing it, update only the requested
  fields, and report the resulting state. Do not turn a narrow request into broad programme cleanup.
- **Human-readable by default, structured when needed.** Use normal output when working with a person.
  Use `--json` when exact fields, pagination or reliable machine processing matter; do not scrape
  decorated terminal output.

## How the platform is organised

Understanding these relationships is most of the job:

- **Context** is the foundation. _Business Context_ describes how the organization actually operates;
  _Operating Context_ scopes the document and compliance programme. Everything else — discovery, document
  generation, risk and vendor suggestions, tests — is grounded in this. Answers merge over time; a new
  answer that conflicts with an existing one goes to review instead of silently overwriting.
- **Frameworks** (SOC 2, ISO 27001, …) are applied to the tenant and bring their **clauses** and
  **tests** with them.
- A **test** is a single requirement check. Each test has **runs**, one per month — the server enforces
  that cadence. A run collects **evidence items**: uploaded files, native documents, or results from
  monitoring **checks**. Attaching evidence starts an AI pipeline that digests the item, judges its
  **relevance** to the test, and produces an **assurance** view. A human then records the **run
  result** (`passing`, `failing`, `skipped`, or back to `pending`), which is a formal decision.
- **Documents** (the Document Library) have a lifecycle: `draft` → review → approval → `approved`. Only a
  draft is editable; changing an approved document means creating a new version.
- **Files** are uploads and the file system. Keep the two words apart: the Document Library holds design
  documents; Files holds uploaded files.
- **Risks**, **vendors** and **assets** are registers with their own state (status, owner, criticality,
  review status, classification). Each has a stable code, and state changes are auditable. A risk also
  carries a **treatment** (strategy and notes) and **scores**; an asset carries **tags** and is mapped to
  controls, risks, tests and checks.
- **Clauses** and **controls** are what you are assessed against. A clause belongs to a framework and
  carries an applicability and a design-requirement assessment; a control is the tenant's own layer with
  a status, an owner, an applicability and design requirements.
- **Monitoring checks** run continuously against connected integrations and produce results on their own.
  A check can be turned on or off for the tenant, and its run history and linked findings are readable.

Two consequences worth internalising:

- **AI output is never a verdict.** An assessment that hasn't been evaluated reads as _not assessed_ —
  never a guess. Honest absence beats a plausible answer.
- **Not found ≠ no access ≠ not assessed.** These are different facts and are reported differently.
  Do not collapse them.

## How to operate

- **Names or codes, not ids.** Documents, tests, controls, clauses, risks, vendors, checks and assets are
  addressed by their human name **or** their stable code (for example `ACME-DOC-A1B2`, `TSQ-001`,
  `ACME-RSK-CQJ4`, `ACME-AST-M5SD`). Ids work but are never required, and you never invent one. Prefer the
  code when a name is ambiguous.
- **Intents, not steps.** Ask for the outcome; don't orchestrate the underlying calls. One user-facing
  request may be several platform operations — that composition is the CLI's job, not the user's.
- **Ask only for decisions.** Only actions that change something a person should review stop for
  confirmation — deleting, editing content, linking, or changing a control, clause, test or asset. A
  formal decision is its own verb (`approve`, `submit`, `test run result`) and applies directly. Everything
  else just happens. Use `--yes` only when the user has already authorised that exact change; it removes
  an interactive prompt, not the need for authority.
- **Async work returns a job id.** Attaching evidence or starting AI work returns a job id immediately and
  does not block; report the id and let the user track it with `ciphrix job status`.
- **Rich text is Markdown.** Document content and descriptions come back as Markdown, and you supply
  Markdown.
- **Lists paginate.** You'll see `showing 1–25 of N · next: --page 2`; page through rather than assuming
  you have everything.
- **`--json`** gives the raw payload when you need exact fields.

## Patterns

These are the shapes of the work; run `ciphrix <resource> --help` for the exact flags.

**Answer "what does the platform know about us?"** Start with context: read Business and Operating
Context, and check what's still unanswered. This is the usual first move when a request is broad, because
everything downstream depends on it.

**Change a document.** Read it, decide whether the change is **content** or **metadata**, and act
accordingly. If the document is approved, you must open a new version first — editing an approved document
is refused by design. Publishing and approving are formal, separate steps; don't fold them into the edit.
When drafting content, preserve the user's intended policy position and clearly separate current practice
from proposals or future commitments.

**Attach evidence to a test.** Find the test, then attach in one step with a local file
(`test attach "<test>" --file <path>`). The command stages the file and attaches it; you do not need to
stage and attach separately. Only stage a file on its own when you intend to attach it later or reuse it
across several items. After attaching, report the returned job id and point at `ciphrix job status` — the
relevance judgement is not instant.

**See what you're assessed against.** A framework holds **clauses**; each clause carries an applicability
and a design-requirement assessment and is mapped to tests and documents. Read the clauses, then the one
that matters. **Controls** are the tenant's own layer over that: `control list` and `control get` show the
status, owner, applicability and design requirements, and `control items` shows what is mapped to it.
Ownership, applicability, design requirements and notes are yours to change; a control's or test's name and
description belong to the catalogue and are refused for system records (use `--rename` only on custom ones).

**Record a result.** A run result is a decision, not a note. `pending` is not "failed" — it reopens the
run for more evidence. Use it deliberately.

**Triage a risk, vendor or asset.** Read the current record first, then update only the fields you're
changing. Report which fields applied and which were refused; don't assume success. A risk's treatment and
scores are their own reads; a vendor's or risk's files are listed and changed separately from the record
itself.

**Work the checks.** `check list` shows status and compliance; `check runs` is the history; `check findings`
are what a check raised. `check disable` silences a check for the tenant — record why with `--notes`.

**Check on background work.** Anything that returns a job id is polled, not awaited.

## Guardrails

- Work only in the tenant and API environment the authenticated user selected. Never discover or switch
  tenants, endpoints or credential stores by guessing.
- Do not expose access tokens, stored credentials or sensitive response data in prose, logs or commands.
  Prefer the OS keychain. File-based credential storage and plaintext HTTP are explicit local/testing
  opt-ins, never defaults.
- Do not retry denied actions through another command, weaken authorization, or reinterpret an access
  failure as a missing record.
- Don't edit an approved document; create a new version.
- Don't treat `pending` as a failure or as "done".
- Don't invent AI assessments. If it isn't evaluated, say so.
- Don't guess when a name is ambiguous — the CLI lists the candidates and stops; take that as your answer
  and ask the user.
- Don't stage a file and then attach it when a single attach-with-file command exists.
- Before a consequential write, make sure the target resolved to the intended record. After the write,
  report the server's outcome rather than claiming success from the command exit alone.

## Finding exact syntax

The command surface is discoverable and always current — don't memorise or infer it:

- `ciphrix --help` — the resources and verbs.
- `ciphrix <resource> --help` — flags for a resource.
- `ciphrix <resource> <verb> --help` — exact arguments and write semantics.
- [`references/commands.md`](references/commands.md) — generated command and option reference for offline discovery; live help from the installed CLI remains authoritative.

If the CLI does not expose the requested capability, say so. Do not call private endpoints, reproduce
backend logic, or invent a command from this guide.
