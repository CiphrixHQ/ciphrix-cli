# Ciphrix CLI command reference

> Generated from the Commander command tree and help output. Regenerate with `npm run commands:generate`; CI checks for drift with `npm run commands:check`.
>
> Live `ciphrix --help` and `ciphrix <command> --help` output is authoritative for the installed version.

The sections below are captured from the CLI help implementation. Positional arguments in `<angle brackets>` are required; `[square brackets]` are optional. `Options` lists flags accepted by that command. Commander defaults are shown when defined in the command tree; descriptions also call out defaults that are part of the public interface.

## `ciphrix`

```text
Usage: ciphrix [options] [command]

Ciphrix compliance platform CLI

Options:
  -v, --version          output the version number
  --allow-insecure-http  allow plaintext HTTP for intentional local or
                         non-production testing only
  -h, --help             display help for command

Commands:
  login [options] [url]  Sign in to Ciphrix with device authorization
  logout [options]       Revoke the remote session and remove the stored
                         credential
  context                Read and update Business / Operating Context
  test                   Tests, their runs, items and ownership
  framework              Applied frameworks
  asset                  The asset register
  vendor                 Manage vendors
  control                Controls: status, applicability, owner and design
                         requirements
  document               Browse, read and change documents
  risk                   Manage risks
  check                  Monitoring checks
  job                    Check background jobs started by other commands
```

## `ciphrix login`

```text
Usage: ciphrix login [options] [url]

Sign in to Ciphrix with device authorization

Options:
  --api-url <url>       API base URL
  --device-name <name>  a name for this device (defaults to the machine name)
  --no-open             do not open the verification link in a browser
  -h, --help            display help for command
```

**Effect:** Starts device authorization and stores the credential after sign-in succeeds; opens the verification link by default unless --no-open is supplied.

## `ciphrix logout`

```text
Usage: ciphrix logout [options]

Revoke the remote session and remove the stored credential

Options:
  --api-url <url>  API base URL
  --local-only     remove the local credential without revoking the remote
                   session
  -h, --help       display help for command
```

**Effect:** Revokes the remote session before removing the stored credential; use --local-only to remove the local credential without remote revocation.

## `ciphrix context`

```text
Usage: ciphrix context [options] [command]

Read and update Business / Operating Context

Options:
  -h, --help                      display help for command

Commands:
  get [options] <store>           Print a context digest (business | operating)
  status [options] <store>        Show context completion and unanswered
                                  questions
  set [options] <target> <value>  Set one answer, for example
                                  business.company_size "50-200"
  reset [options]                 Reset Business Context (asks to confirm)
  help [command]                  display help for command
```

## `ciphrix context get`

```text
Usage: ciphrix context get [options] <store>

Print a context digest (business | operating)

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix context status`

```text
Usage: ciphrix context status [options] <store>

Show context completion and unanswered questions

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix context set`

```text
Usage: ciphrix context set [options] <target> <value>

Set one answer, for example business.company_size "50-200"

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Changes a Business or Operating Context answer through the direct API write path.

## `ciphrix context reset`

```text
Usage: ciphrix context reset [options]

Reset Business Context (asks to confirm)

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Resets Business Context. The CLI asks for confirmation when required; --yes skips that prompt.

## `ciphrix test`

```text
Usage: ciphrix test [options] [command]

Tests, their runs, items and ownership

Options:
  -h, --help                  display help for command

Commands:
  list [options]              List tests with their latest run status
  get [options] <name>        Show a test, its runs and AI assurance
  runs [options] <name>       List a test’s runs with AI assurance
  items [options] <name>      List a run’s evidence with AI relevance (defaults
                              to the current run)
  attach [options] <name>     Attach evidence to a run (defaults to the current
                              run)
  run                         Create, result and delete runs
  available [options] <name>  List items available to attach to a run (defaults
                              to the current run)
  links [options] <name>      Show the controls and clauses a test covers
  update [options] <name>     Change applicability, responsibility, assignee,
                              frequency or auto-pass
  delete [options] <name>     Delete a custom test
  help [command]              display help for command
```

## `ciphrix test list`

```text
Usage: ciphrix test list [options]

List tests with their latest run status

Options:
  --search <text>  filter by name
  --status <csv>   filter by latest run status
  --page <n>       page number
  --limit <n>      page size
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix test get`

```text
Usage: ciphrix test get [options] <name>

Show a test, its runs and AI assurance

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix test runs`

```text
Usage: ciphrix test runs [options] <name>

List a test’s runs with AI assurance

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix test items`

```text
Usage: ciphrix test items [options] <name>

List a run’s evidence with AI relevance (defaults to the current run)

Options:
  --run <id>       a specific run
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix test attach`

```text
Usage: ciphrix test attach [options] <name>

Attach evidence to a run (defaults to the current run)

Options:
  --check <id>       link a check
  --native-doc <id>  link a native document
  --upload <id>      link a staged upload id
  --file <path>      upload a local file and attach it
  --run <id>         a specific run
  --unlink           unlink instead of link
  --api-url <url>    API base URL
  --json             output raw JSON
  -h, --help         display help for command
```

**Effect:** Attaches or unlinks evidence. A local --file is uploaded and attached in the same command; the command can return a background job id.

## `ciphrix test run`

```text
Usage: ciphrix test run [options] [command]

Create, result and delete runs

Options:
  -h, --help               display help for command

Commands:
  create [options] <name>  Create a new pending run
  result [options] <name>  Record a run result: passing | failing | skipped |
                           pending (reopen)
  delete [options] <name>  Delete a run
  help [command]           display help for command
```

## `ciphrix test run create`

```text
Usage: ciphrix test run create [options] <name>

Create a new pending run

Options:
  --run-at <date>  run date (ISO); defaults to now
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Creates a pending test run; the CLI prompts if the API requests confirmation.

## `ciphrix test run result`

```text
Usage: ciphrix test run result [options] <name>

Record a run result: passing | failing | skipped | pending (reopen)

Options:
  --status <status>  passing | failing | skipped | pending
  --note <text>      note for the run
  --run <id>         a specific run
  --api-url <url>    API base URL
  --json             output raw JSON
  -h, --help         display help for command
```

**Effect:** Records a formal test-run result; the CLI prompts if the API requests confirmation.

## `ciphrix test run delete`

```text
Usage: ciphrix test run delete [options] <name>

Delete a run

Options:
  --run <id>       the run to delete
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Deletes the selected test run; the CLI asks for confirmation when required.

## `ciphrix test available`

```text
Usage: ciphrix test available [options] <name>

List items available to attach to a run (defaults to the current run)

Options:
  --type <type>    item type: native_doc or check
  --run <id>       a specific run
  --search <text>  filter by item name
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix test links`

```text
Usage: ciphrix test links [options] <name>

Show the controls and clauses a test covers

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix test update`

```text
Usage: ciphrix test update [options] <name>

Change applicability, responsibility, assignee, frequency or auto-pass

Options:
  --applicability <value>   in_scope or out_of_scope
  --responsibility <value>  internal, third_party or shared
  --assigned-to <id>        owner user id
  --frequency <value>       none, monthly, quarterly, half-yearly or yearly
  --next-run-at <date>      ISO date for the next run
  --auto-pass <on|off>      auto-pass from checks
  --rename <text>           new name (custom tests only)
  --guidance <text>         new guidance (custom tests only)
  --yes                     apply without prompting
  --api-url <url>           API base URL
  --json                    output raw JSON
  -h, --help                display help for command
```

**Effect:** Changes test settings; the CLI asks for confirmation when required.

## `ciphrix test delete`

```text
Usage: ciphrix test delete [options] <name>

Delete a custom test

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Deletes a custom test; the CLI asks for confirmation when required.

## `ciphrix framework`

```text
Usage: ciphrix framework [options] [command]

Applied frameworks

Options:
  -h, --help                                    display help for command

Commands:
  list [options]                                List applied frameworks with status and available frameworks
  clauses [options] <framework>                 List a framework’s clauses
  clause [options] <framework> <clause>         Show one clause by code or name
  items [options] <framework> <clause>          List the items mapped to a clause
  available [options] <framework> <clause>      List items that can be mapped to a clause
  update [options] <framework> <clause>         Change a clause’s applicability or design-requirement assessment
  link [options] <framework> <clause> <itemId>  Map a test or document to a clause
  help [command]                                display help for command
```

## `ciphrix framework list`

```text
Usage: ciphrix framework list [options]

List applied frameworks with status and available frameworks

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix framework clauses`

```text
Usage: ciphrix framework clauses [options] <framework>

List a framework’s clauses

Options:
  --search <text>          filter by clause code or name
  --applicability <value>  in_scope or out_of_scope
  --page <n>               page number
  --limit <n>              page size
  --api-url <url>          API base URL
  --json                   output raw JSON
  -h, --help               display help for command
```

## `ciphrix framework clause`

```text
Usage: ciphrix framework clause [options] <framework> <clause>

Show one clause by code or name

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix framework items`

```text
Usage: ciphrix framework items [options] <framework> <clause>

List the items mapped to a clause

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix framework available`

```text
Usage: ciphrix framework available [options] <framework> <clause>

List items that can be mapped to a clause

Options:
  --type <type>    item type: test or document
  --search <text>  filter by item name
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix framework update`

```text
Usage: ciphrix framework update [options] <framework> <clause>

Change a clause’s applicability or design-requirement assessment

Options:
  --applicability <value>        in_scope or out_of_scope
  --justification <text>         why the applicability changed
  --design-requirements <state>  not_assessed | not_needed | not_met | partial |
                                 met
  --yes                          apply without prompting
  --api-url <url>                API base URL
  --json                         output raw JSON
  -h, --help                     display help for command
```

**Effect:** Changes a clause assessment; the CLI asks for confirmation when required.

## `ciphrix framework link`

```text
Usage: ciphrix framework link [options] <framework> <clause> <itemId>

Map a test or document to a clause

Options:
  --type <type>    item type: test or document
  --unlink         unlink instead of link
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Links or unlinks a test or document to a clause; the CLI asks for confirmation when required.

## `ciphrix asset`

```text
Usage: ciphrix asset [options] [command]

The asset register

Options:
  -h, --help                display help for command

Commands:
  list [options]            List assets with their code, status and
                            classification
  get [options] <asset>     Show one asset by code, customer key or name
  links [options] <asset>   List the controls, risks, tests or checks mapped to
                            an asset
  update [options] <asset>  Change asset fields
  create [options]          Create an asset
  delete [options] <asset>  Delete an asset
  tags [options] <asset>    List an asset’s tags
  tag [options] <asset>     Assign a key/value tag to an asset, or remove one
  help [command]            display help for command
```

## `ciphrix asset list`

```text
Usage: ciphrix asset list [options]

List assets with their code, status and classification

Options:
  --name <text>                  filter by name
  --category <value>             filter by category
  --status <csv>                 filter by status
  --business-impact <value>      filter by business impact
  --data-classification <value>  filter by data classification
  --page <n>                     page number
  --limit <n>                    page size
  --api-url <url>                API base URL
  --json                         output raw JSON
  -h, --help                     display help for command
```

## `ciphrix asset get`

```text
Usage: ciphrix asset get [options] <asset>

Show one asset by code, customer key or name

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix asset links`

```text
Usage: ciphrix asset links [options] <asset>

List the controls, risks, tests or checks mapped to an asset

Options:
  --type <type>    controls, risks, tests or checks
  --page <n>       page number
  --limit <n>      page size
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix asset update`

```text
Usage: ciphrix asset update [options] <asset>

Change asset fields

Options:
  --name <text>                  rename
  --description <text>           description
  --category <value>             category
  --sub-category <value>         sub-category
  --status <value>               status
  --data-classification <value>  data classification
  --business-impact <value>      business impact
  --technical-owner <id>         technical owner user id
  --business-owner <value>       business owner
  --customer-asset-key <value>   the tenant’s own key for this asset
  --external-ref <value>         external reference id
  --location <value>             location
  --yes                          apply without prompting
  --api-url <url>                API base URL
  --json                         output raw JSON
  -h, --help                     display help for command
```

**Effect:** Changes asset fields; the CLI asks for confirmation when required.

## `ciphrix asset create`

```text
Usage: ciphrix asset create [options]

Create an asset

Options:
  --name <name>                  asset name
  --category <value>             category
  --sub-category <value>         sub-category
  --customer-key <value>         the tenant’s own key for this asset
  --external-ref <value>         external reference id
  --description <text>           description
  --status <value>               status
  --business-impact <value>      business impact
  --data-classification <value>  data classification
  --technical-owner <id>         technical owner user id
  --business-owner <value>       business owner
  --location <value>             location
  --api-url <url>                API base URL
  --json                         output raw JSON
  -h, --help                     display help for command
```

**Effect:** Creates an asset; the CLI prompts if the API requests confirmation.

## `ciphrix asset delete`

```text
Usage: ciphrix asset delete [options] <asset>

Delete an asset

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Deletes an asset; the CLI asks for confirmation when required.

## `ciphrix asset tags`

```text
Usage: ciphrix asset tags [options] <asset>

List an asset’s tags

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix asset tag`

```text
Usage: ciphrix asset tag [options] <asset>

Assign a key/value tag to an asset, or remove one

Options:
  --key <key>           tag key
  --value <value>       tag value
  --unlink <mappingId>  tag mapping id to remove
  --yes                 apply without prompting
  --api-url <url>       API base URL
  --json                output raw JSON
  -h, --help            display help for command
```

**Effect:** Adds or removes an asset tag; the CLI asks for confirmation when required.

## `ciphrix vendor`

```text
Usage: ciphrix vendor [options] [command]

Manage vendors

Options:
  -h, --help                           display help for command

Commands:
  list [options]                       List vendors with a total count
  get [options] <name>                 Show one vendor
  create [options]                     Create a vendor
  update [options] <name>              Update vendor fields
  delete [options] <name>              Delete a vendor
  files [options] <name>               List the files attached to a vendor
  attach [options] <name>              Attach a file to a vendor
  detach [options] <name> <mappingId>  Detach a file from a vendor by its
                                       mapping id
  help [command]                       display help for command
```

## `ciphrix vendor list`

```text
Usage: ciphrix vendor list [options]

List vendors with a total count

Options:
  --name <text>                  filter by name
  --criticality <value>          filter by criticality
  --relationship-status <value>  filter by relationship status
  --page <n>                     page number
  --limit <n>                    page size
  --api-url <url>                API base URL
  --json                         output raw JSON
  -h, --help                     display help for command
```

## `ciphrix vendor get`

```text
Usage: ciphrix vendor get [options] <name>

Show one vendor

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix vendor create`

```text
Usage: ciphrix vendor create [options]

Create a vendor

Options:
  --name <name>          vendor name
  --category <value>     category
  --criticality <value>  criticality
  --description <text>   description
  --api-url <url>        API base URL
  --json                 output raw JSON
  -h, --help             display help for command
```

**Effect:** Creates a vendor; the CLI prompts if the API requests confirmation.

## `ciphrix vendor update`

```text
Usage: ciphrix vendor update [options] <name>

Update vendor fields

Options:
  --name <value>                 rename
  --website <value>              website
  --description <value>          description
  --category <value>             category
  --criticality <value>          business criticality
  --data-sensitivity <value>     public | internal | confidential | pii | phi
  --relationship-status <value>  active | inactive | onboarding | terminated
  --review-status <value>        pending | completed | expired
  --internal-owner <value>       internal owner (email)
  --api-url <url>                API base URL
  --json                         output raw JSON
  -h, --help                     display help for command
```

**Effect:** Changes vendor fields; the CLI prompts if the API requests confirmation.

## `ciphrix vendor delete`

```text
Usage: ciphrix vendor delete [options] <name>

Delete a vendor

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Deletes a vendor; the CLI asks for confirmation when required.

## `ciphrix vendor files`

```text
Usage: ciphrix vendor files [options] <name>

List the files attached to a vendor

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix vendor attach`

```text
Usage: ciphrix vendor attach [options] <name>

Attach a file to a vendor

Options:
  --file <path>    stage and attach a local file
  --upload <id>    attach an already-staged upload
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Attaches a staged or local file; the CLI asks for confirmation when required.

## `ciphrix vendor detach`

```text
Usage: ciphrix vendor detach [options] <name> <mappingId>

Detach a file from a vendor by its mapping id

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Detaches a file; the CLI asks for confirmation when required.

## `ciphrix control`

```text
Usage: ciphrix control [options] [command]

Controls: status, applicability, owner and design requirements

Options:
  -h, --help                         display help for command

Commands:
  list [options]                     List controls with their status,
                                     applicability and owner
  get [options] <control>            Show one control by name or code
  items [options] <control>          List the items linked to a control
  available [options] <control>      List items that can be linked to a control
  update [options] <control>         Change owner, applicability, design
                                     requirements or notes
  link [options] <control> <itemId>  Link a test or document to a control
  help [command]                     display help for command
```

## `ciphrix control list`

```text
Usage: ciphrix control list [options]

List controls with their status, applicability and owner

Options:
  --search <text>          filter by name or code
  --domain <value>         filter by control domain
  --status <csv>           filter by status
  --applicability <value>  filter by applicability (in_scope|out_of_scope)
  --page <n>               page number
  --limit <n>              page size
  --api-url <url>          API base URL
  --json                   output raw JSON
  -h, --help               display help for command
```

## `ciphrix control get`

```text
Usage: ciphrix control get [options] <control>

Show one control by name or code

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix control items`

```text
Usage: ciphrix control items [options] <control>

List the items linked to a control

Options:
  --search <text>  filter by item name
  --page <n>       page number
  --limit <n>      page size
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix control available`

```text
Usage: ciphrix control available [options] <control>

List items that can be linked to a control

Options:
  --type <type>    item type: test or document
  --search <text>  filter by item name
  --page <n>       page number
  --limit <n>      page size
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix control update`

```text
Usage: ciphrix control update [options] <control>

Change owner, applicability, design requirements or notes

Options:
  --owner <id|none>              owner user id, or none to clear
  --applicability <value>        in_scope or out_of_scope
  --justification <text>         why the applicability changed
  --design-requirements <state>  not_assessed | not_needed | not_met | partial |
                                 met
  --notes <text>                 notes (Markdown)
  --rename <text>                new name (custom controls only)
  --yes                          apply without prompting
  --api-url <url>                API base URL
  --json                         output raw JSON
  -h, --help                     display help for command
```

**Effect:** Changes control fields; the CLI asks for confirmation when required.

## `ciphrix control link`

```text
Usage: ciphrix control link [options] <control> <itemId>

Link a test or document to a control

Options:
  --type <type>    item type: test or document
  --unlink         unlink instead of link
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Links or unlinks a test or document to a control; the CLI asks for confirmation when required.

## `ciphrix document`

```text
Usage: ciphrix document [options] [command]

Browse, read and change documents

Options:
  -h, --help                     display help for command

Commands:
  list [options]                 List documents with status and counts
  get [options] <document>       Print a document as Markdown (by name or id)
  update [options] <document>    Update document metadata
  versions [options] <document>  Show a document’s version history
  create [options]               Create a new blank document
  edit [options] <document>      Replace the content of a draft document with
                                 Markdown
  version [options] <document>   Create a new draft version of a document
  submit [options] <document>    Submit a draft document for review
  approve [options] <document>   Approve a document awaiting approval
  delete [options] <document>    Delete a document
  help [command]                 display help for command
```

## `ciphrix document list`

```text
Usage: ciphrix document list [options]

List documents with status and counts

Options:
  --name <text>    filter by name
  --status <csv>   filter by workflow status
  --page <n>       page number
  --limit <n>      page size
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix document get`

```text
Usage: ciphrix document get [options] <document>

Print a document as Markdown (by name or id)

Options:
  --version-number <n>  a specific version number
  --minor-number <n>    a specific minor version (with --version-number)
  --api-url <url>       API base URL
  --json                output raw JSON
  -h, --help            display help for command
```

## `ciphrix document update`

```text
Usage: ciphrix document update [options] <document>

Update document metadata

Options:
  --name <value>         rename
  --description <value>  description
  --type <value>         document type
  --publish <on|off>     published state
  --api-url <url>        API base URL
  --json                 output raw JSON
  -h, --help             display help for command
```

**Effect:** Changes document metadata; the CLI prompts if the API requests confirmation.

## `ciphrix document versions`

```text
Usage: ciphrix document versions [options] <document>

Show a document’s version history

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix document create`

```text
Usage: ciphrix document create [options]

Create a new blank document

Options:
  --name <name>         policy name
  --type <type>         document type
  --description <text>  short description
  --api-url <url>       API base URL
  --json                output raw JSON
  -h, --help            display help for command
```

**Effect:** Creates a blank document; the CLI prompts if the API requests confirmation.

## `ciphrix document edit`

```text
Usage: ciphrix document edit [options] <document>

Replace the content of a draft document with Markdown

Options:
  --file <path>         read the new Markdown from a file
  --content <markdown>  new Markdown inline
  --yes                 apply without prompting
  --api-url <url>       API base URL
  --json                output raw JSON
  -h, --help            display help for command
```

**Effect:** Replaces draft document content; the CLI asks for confirmation when required.

## `ciphrix document version`

```text
Usage: ciphrix document version [options] <document>

Create a new draft version of a document

Options:
  --change-type <type>  change type
  --summary <text>      change summary
  --yes                 apply without prompting
  --api-url <url>       API base URL
  --json                output raw JSON
  -h, --help            display help for command
```

**Effect:** Creates a new draft version; the CLI asks for confirmation when required.

## `ciphrix document submit`

```text
Usage: ciphrix document submit [options] <document>

Submit a draft document for review

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Submits a draft for review; the CLI asks for confirmation when required.

## `ciphrix document approve`

```text
Usage: ciphrix document approve [options] <document>

Approve a document awaiting approval

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Records a formal document approval; the CLI asks for confirmation when required.

## `ciphrix document delete`

```text
Usage: ciphrix document delete [options] <document>

Delete a document

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Deletes a document; the CLI asks for confirmation when required.

## `ciphrix risk`

```text
Usage: ciphrix risk [options] [command]

Manage risks

Options:
  -h, --help                           display help for command

Commands:
  list [options]                       List the risk register
  get [options] <risk>                 Show one risk by title or id
  update [options] <risk>              Update risk fields
  create [options]                     Create a risk
  delete [options] <risk>              Delete a risk
  treatment [options] <risk>           Show a risk’s treatment strategy and
                                       notes
  scores [options] <risk>              Show a risk’s scores
  controls [options] <risk>            List the controls linked to a risk
  link [options] <risk>                Link a control to a risk, or unlink a
                                       mapping
  files [options] <risk>               List the files attached to a risk
  attach [options] <risk>              Attach a file to a risk
  detach [options] <risk> <mappingId>  Detach a file from a risk by its mapping
                                       id
  help [command]                       display help for command
```

## `ciphrix risk list`

```text
Usage: ciphrix risk list [options]

List the risk register

Options:
  --status <csv>           filter by status
  --business-unit <value>  filter by business unit
  --page <n>               page number
  --limit <n>              page size
  --api-url <url>          API base URL
  --json                   output raw JSON
  -h, --help               display help for command
```

## `ciphrix risk get`

```text
Usage: ciphrix risk get [options] <risk>

Show one risk by title or id

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix risk update`

```text
Usage: ciphrix risk update [options] <risk>

Update risk fields

Options:
  --status <value>          open | in_treatment | monitor | closed
  --title <value>           title
  --description <value>     description
  --owner <value>           owner
  --treatment-type <value>  treatment strategy
  --treatment-notes <text>  treatment notes (Markdown)
  --business-unit <value>   business unit
  --api-url <url>           API base URL
  --json                    output raw JSON
  -h, --help                display help for command
```

**Effect:** Changes risk fields; the CLI prompts if the API requests confirmation.

## `ciphrix risk create`

```text
Usage: ciphrix risk create [options]

Create a risk

Options:
  --title <title>        risk title
  --category <value>     category
  --description <value>  description
  --api-url <url>        API base URL
  --json                 output raw JSON
  -h, --help             display help for command
```

**Effect:** Creates a risk; the CLI prompts if the API requests confirmation.

## `ciphrix risk delete`

```text
Usage: ciphrix risk delete [options] <risk>

Delete a risk

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Deletes a risk; the CLI asks for confirmation when required.

## `ciphrix risk treatment`

```text
Usage: ciphrix risk treatment [options] <risk>

Show a risk’s treatment strategy and notes

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix risk scores`

```text
Usage: ciphrix risk scores [options] <risk>

Show a risk’s scores

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix risk controls`

```text
Usage: ciphrix risk controls [options] <risk>

List the controls linked to a risk

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix risk link`

```text
Usage: ciphrix risk link [options] <risk>

Link a control to a risk, or unlink a mapping

Options:
  --control <id>        control instance id to link
  --unlink <mappingId>  control mapping id to unlink
  --yes                 apply without prompting
  --api-url <url>       API base URL
  --json                output raw JSON
  -h, --help            display help for command
```

**Effect:** Links or unlinks a control to a risk; the CLI asks for confirmation when required.

## `ciphrix risk files`

```text
Usage: ciphrix risk files [options] <risk>

List the files attached to a risk

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix risk attach`

```text
Usage: ciphrix risk attach [options] <risk>

Attach a file to a risk

Options:
  --file <path>    stage and attach a local file
  --upload <id>    attach an already-staged upload
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Attaches a staged or local file; the CLI asks for confirmation when required.

## `ciphrix risk detach`

```text
Usage: ciphrix risk detach [options] <risk> <mappingId>

Detach a file from a risk by its mapping id

Options:
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Detaches a file; the CLI asks for confirmation when required.

## `ciphrix check`

```text
Usage: ciphrix check [options] [command]

Monitoring checks

Options:
  -h, --help                   display help for command

Commands:
  list [options]               List monitoring checks
  resources [options] <check>  List the resources covered by a check
  run [options] <check>        Show a check’s latest run
  integrations [options]       List check integration types
  runs [options] <check>       List a check’s run history
  findings [options] <check>   List the findings raised from a check
  enable [options] <check>     Enable a check for this tenant
  disable [options] <check>    Disable a check for this tenant
  help [command]               display help for command
```

## `ciphrix check list`

```text
Usage: ciphrix check list [options]

List monitoring checks

Options:
  --integration-type <csv>  filter by integration type
  --status <csv>            filter by status
  --page <n>                page number
  --limit <n>               page size
  --api-url <url>           API base URL
  --json                    output raw JSON
  -h, --help                display help for command
```

## `ciphrix check resources`

```text
Usage: ciphrix check resources [options] <check>

List the resources covered by a check

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix check run`

```text
Usage: ciphrix check run [options] <check>

Show a check’s latest run

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Read-only: shows the latest run for a monitoring check.

## `ciphrix check integrations`

```text
Usage: ciphrix check integrations [options]

List check integration types

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix check runs`

```text
Usage: ciphrix check runs [options] <check>

List a check’s run history

Options:
  --page <n>       page number
  --limit <n>      page size
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix check findings`

```text
Usage: ciphrix check findings [options] <check>

List the findings raised from a check

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## `ciphrix check enable`

```text
Usage: ciphrix check enable [options] <check>

Enable a check for this tenant

Options:
  --notes <text>   why
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Enables a monitoring check for this tenant; the CLI asks for confirmation when required.

## `ciphrix check disable`

```text
Usage: ciphrix check disable [options] <check>

Disable a check for this tenant

Options:
  --notes <text>   why
  --yes            apply without prompting
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

**Effect:** Disables a monitoring check for this tenant; the CLI asks for confirmation when required.

## `ciphrix job`

```text
Usage: ciphrix job [options] [command]

Check background jobs started by other commands

Options:
  -h, --help                display help for command

Commands:
  status [options] <jobId>  Show the status of a background job
  help [command]            display help for command
```

## `ciphrix job status`

```text
Usage: ciphrix job status [options] <jobId>

Show the status of a background job

Options:
  --api-url <url>  API base URL
  --json           output raw JSON
  -h, --help       display help for command
```

## Behavioral defaults

- API URL selection uses `--api-url`, then `CIPHRIX_API_URL`, then the production API default. API URLs must use HTTPS unless plaintext HTTP is explicitly enabled with `--allow-insecure-http` or `CIPHRIX_ALLOW_INSECURE_HTTP=true`.
- Credentials use the operating system keychain by default. File-based credential storage requires the explicit `CIPHRIX_CREDENTIAL_STORE=file` opt-in.
- Commands that accept `--page` or `--limit` use the server/API pagination defaults when omitted.
- Commands whose help says they use the current run use that run when `--run` is omitted; `test run create` defaults its date to now.

## Safe examples

```sh
ciphrix --help
ciphrix login --api-url https://api.example.com
ciphrix document get 'Example Policy'
ciphrix test list --page 1 --limit 25
ciphrix asset get '<asset-code>'
```

Examples use generic values. Replace placeholders with values from the authenticated tenant; never guess identifiers. Use `--yes` only after the user authorized that specific change. It bypasses an interactive confirmation prompt when one is requested; it does not grant access or override API authorization.
