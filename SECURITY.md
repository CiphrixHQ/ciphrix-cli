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

- The CLI stores credentials in your operating system's keychain and never writes them to logs.
- If you believe a token has leaked, revoke it (or run `ciphrix logout`) and report it to us.
- Never include tokens, secrets or real customer data in an issue or pull request.
