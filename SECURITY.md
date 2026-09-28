# Security Policy

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, discussions or pull
requests.

Instead, email **security@ciphrix.com** with:

- a description of the issue and its impact,
- steps to reproduce,
- the affected version(s),
- any suggested fix or mitigation.

We will acknowledge your report and keep you updated on remediation. Please give us a reasonable window to
release a fix before any public disclosure.

## Supported versions

The project is pre-release. Once `1.0.0` ships, the latest minor release line receives security fixes.

## Handling credentials

- By default, the CLI stores credentials in your operating system's keychain and never writes them to
  logs. If the keychain cannot be loaded or accessed, the CLI reports an error and does not switch to
  another store.
- For local or headless testing only, you can explicitly set `CIPHRIX_CREDENTIAL_STORE=file`. This
  stores credentials as plaintext JSON in the CLI configuration directory, protected with `0700`
  directory and `0600` file permissions where supported. Existing permissive modes are corrected.
  The file store rejects malformed or unsafe files rather than replacing them. Anyone who can read
  the account's files can still access these credentials, so use the keychain for normal use.
- If you believe a token has leaked, revoke its remote session in account session settings and report
  it to us. `ciphrix logout` attempts remote revocation before deleting the local credential. If the
  API cannot confirm revocation because of a network, server or redirect failure, logout retains the
  credential for retry. `ciphrix logout --local-only` only removes the local copy and does not revoke
  the remote session.
- Never include tokens, secrets or real customer data in an issue or pull request.

## API transport

- API URLs must use HTTPS by default. Arbitrary HTTPS base URLs are supported for staging and other
  non-production environments.
- Plaintext HTTP is rejected before the CLI creates device identity, loads an account credential, or
  sends an upload. For intentional local or non-production testing, opt in for one invocation with
  `--allow-insecure-http` or set `CIPHRIX_ALLOW_INSECURE_HTTP=true`. The opt-in permits any HTTP
  endpoint and can expose credentials and data to network observers; use it only on a trusted network.
- API URLs cannot contain embedded credentials, query strings, or fragments, and schemes other than
  HTTP(S) are rejected.
- The CLI does not follow HTTP redirects for authenticated API calls or uploads. Configure the final
  endpoint directly so credentials and uploaded files cannot be forwarded to another origin or over
  downgraded transport.
