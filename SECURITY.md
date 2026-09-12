# Security policy

`client-sf-oauth` moves Salesforce credentials — certificates, client secrets,
passwords, authorization codes, and the tokens they buy. A defect in this
library can expose one of them, so anything that could is treated as a
security issue, not only what a dependency scanner reports.

## Supported versions

| Version | Supported |
|---|---|
| 0.7.x | Yes — security fixes are released as patch versions |
| < 0.7.0 | No — upgrade. 0.7.0 fixed several credential-exposure defects; see `CHANGELOG.md` |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

1. Preferred: use GitHub's private vulnerability reporting on the repository —
   <https://github.com/clemb8/client-sf-oauth/security/advisories/new>. The
   maintainer enables this in the repository's security settings; if the page
   reports that private reporting is not enabled, use the e-mail below.
2. Fallback: e-mail the maintainer of record on npm, `clem.boschet@gmail.com`,
   with `client-sf-oauth security` in the subject.

Include the version, the flow involved (`SF_JWTConnect`, `SF_WebAppConnect`,
`SF_PassConnect`), a description of the impact, and steps to reproduce. Do not
include real credentials, keys, or tokens in the report; describe them.

**Response window.** This is a single-maintainer project. Expect an
acknowledgement within 7 days and a fix or a mitigation plan within 30 days of
acknowledgement for a confirmed issue. You will be credited in the changelog
unless you ask otherwise.

## What the library guarantees

These are the properties a report should be measured against; each is covered
by the unit suite (`npm test`, no network, no credentials):

- **Validation before I/O.** Every constructor checks its input before any
  network or filesystem access. `host` must be an absolute `https:` URL; the
  required strings must be present and non-empty. Error messages name the
  parameter and never echo its value.
- **HTTPS only.** An `http:` host is rejected, so a credential is never sent
  in cleartext.
- **Body-only credential transport.** Client secrets, passwords, assertions,
  authorization codes, and PKCE verifiers travel in a form-encoded request
  body, never in a query string, and every query-string value is
  percent-encoded.
- **Redacted errors.** A network failure throws an error built only from the
  HTTP status and Salesforce's `error` / `error_description`. The request
  body, URL, headers, and the original transport rejection are never attached,
  not even as `cause`.
- **PKCE on the web server flow.** `SF_WebAppConnect` generates a
  `crypto.randomBytes`-based verifier and an `S256` challenge, and never places
  the verifier in a URL.
- **No key material in the package or the repository.** `*.pem`, `*.key`, and
  `.env*` are ignored by both git and npm packing.

Things the library deliberately does **not** do, so a report about them is a
feature request rather than a vulnerability: token refresh, token revocation,
token storage, and session management. Those belong to the consuming
application.
