## Change Log

<!-- Hand-maintained. Add the entry for the next release BEFORE running
     `npm version`; its `version` hook stages this file into the release
     commit. Nothing regenerates this file, so nothing overwrites it. -->

### v0.7.0 (2026/09/10)

Security release. Clears every known dependency advisory and fixes five
code-level defects that could expose a Salesforce credential. Adds PKCE to the
Web Server flow, which was previously unusable on a default modern Connected
App. No constructor or method signature changed, but **error handling and
input validation changed observably** — read "Action required" before
upgrading.

#### Added

- **PKCE (RFC 7636) on the Web Server flow.** `SF_WebAppConnect` now generates
  a `code_verifier` / `code_challenge` pair and sends an `S256` challenge on
  the authorize request and the verifier on the token exchange.

  This is a **functional fix, not only hardening**. Salesforce requires PKCE by
  default on Connected Apps created since Winter '23 and rejects the authorize
  request outright with `missing required code challenge`. Before this release
  the flow could not complete against such an app at all: the library forwarded
  a caller-supplied `code_challenge` but never sent a verifier.

  In a web application the authorize redirect and the callback are different
  HTTP requests, so read the verifier and persist it with the user's session:

  ```ts
  const client = new SF_WebAppConnect({ clientId, clientSecret, host, redirectURI });
  const url = await client.requestAuthCode();
  req.session.codeVerifier = client.codeVerifier;   // treat as a credential

  // ...in the callback request:
  await client.requestAccessTokenWithCode(code, req.session.codeVerifier);
  ```

  A single long-lived instance needs no change — the verifier is reused
  automatically. `code_verifier`, `code_challenge` and `code_challenge_method`
  are also accepted as constructor parameters if you manage your own pair.
  `requestAccessTokenWithCode` gained an optional second argument; the existing
  one-argument call still compiles.

#### Deprecated

- **`SF_PassConnect` (Username-Password flow).** Salesforce is retiring this
  grant: it is disabled by default on new orgs, and on many orgs the
  *Allow OAuth Username-Password Flows* setting no longer exists, so it cannot
  be enabled by any configuration. It is also the weakest of the three — it
  transmits a password and security token on every call and cannot support
  multi-factor authentication.

  Prefer `SF_JWTConnect` for server-to-server work, or `SF_WebAppConnect` when
  a user is present. The class is marked `@deprecated`, so editors will flag
  it, but it still works where an org permits the grant, carries the same
  security fixes as the other flows, and is **not scheduled for removal from
  this library**.

`v0.6.0` was tagged during this release cycle but never published to npm; its
code is identical to `v0.7.0`.

#### Action required

- **Thrown errors are now redacted.** Network failures previously propagated the
  raw `axios` rejection, whose `config` carried the request body, URL and
  headers — and therefore the client secret, password or assertion. They now
  reject with an `Error` built only from safe fields. Code reading
  `ex.response.status` must move to `ex.status`.

  | Property | Meaning |
  |---|---|
  | `message` | Human-readable summary, safe to log |
  | `status` | HTTP status, when Salesforce responded |
  | `error` | Salesforce's `error` field, e.g. `invalid_grant` |
  | `errorDescription` | Salesforce's `error_description` field |
  | `code` | Transport code when no response arrived, e.g. `ECONNREFUSED` |

  The original rejection is deliberately not attached as `cause`, so a
  structured logger cannot reach `config` through it.

- **Constructors now validate and throw.** `host` must be a syntactically valid
  absolute `https:` URL; `clientId`, `clientSecret`, `username`, `password`,
  `redirectURI` and `secret` must be present and non-empty. Input that was
  previously accepted — a `http:` host, an empty secret, a missing field — now
  throws before any network or filesystem access. Error messages name the
  offending parameter and never echo its value.

- **`host` no longer depends on a trailing slash.** The two flows previously
  disagreed: the password flow required a trailing slash and the Web App flow
  required its absence. Both forms now produce the same endpoint.

#### Security fixes

- **Password grant no longer corrupts or leaks credentials.** The
  `application/x-www-form-urlencoded` body was concatenated from `encodeURI()`
  output, which does not escape `&`, `=`, `+`, `?`, `#` or `/`. A credential
  containing any of those broke the request or **injected additional parameters
  into the token request**. Now built with `URLSearchParams`. `password` and
  `usertoken` are concatenated before encoding, so the boundary between them is
  escaped too.
- **The client secret is no longer put in a URL.** The authorization-code token
  exchange sent `client_secret`, `code` and `redirect_uri` in the query string
  of a POST with an empty body, leaking the Connected App secret into every
  access log, proxy log and referrer on the path. They now travel in a
  form-encoded request body.
- **Authorize-URL values are percent-encoded.** `clientId`, `redirectURI` and
  every extra `WebAuthCodeParameters` field were interpolated raw, so a value
  containing `&` or `=` could append or overwrite authorize parameters.
- **An unvalidated `host` can no longer redirect a credential.** `host` was
  concatenated raw into the endpoint that receives the credential.
- **The JWT key read is guarded.** `fs.readFileSync` ran on a caller-supplied
  path with no existence check and no `try`/`catch`. The path is now validated
  first, and read failures throw an error that names the parameter without
  echoing it — the same parameter carries key material when `secretText` is set.
- **Committed key material removed.** `examples/JWTandPass/key.pem` and
  `cert.pem` are deleted and untracked, and `*.pem` is now gitignored. The pair
  was a throwaway demo key never registered against a real Connected App, so no
  rotation was required. It never reached the npm tarball; only git clones.
- **The docs no longer teach the leak.** Every `console.log(ex)` in `README.md`
  and the examples printed the full rejection, credentials included. The
  examples' hardcoded `'test'` passphrase is now an environment variable.

#### Dependencies

`npm audit` goes from 8 vulnerabilities (1 low, 1 moderate, 6 high) to **0**,
across production and development. The three example packages also report 0.

- `axios` -> `^1.20.0` (clears its advisory range and drops `follow-redirects`)
- `jsonwebtoken` -> `^9.0.3`, resolving `jws` to `>= 3.2.3`
- `form-data` resolves to 4.0.6 transitively, outside the vulnerable range
- `@types/node` moved from `dependencies` to `devDependencies`; it is types-only
  and was inflating every consumer install
- `tslint` removed (deprecated, and the sole root of 4 of the 8 advisories),
  replaced by ESLint 10 with typescript-eslint 8
- `typescript` -> `^5.9.3`

#### Build and tests

- **`npm install` no longer rewrites your working copy.** `prebuild` ran
  `tslint --fix`, so every install, pack and publish mutated files under `src/`.
  It now runs ESLint without `--fix`.
- A test suite exists for the first time: Vitest, 13 tests, no network access and
  no credentials required. `npm test` runs it instead of the failing stub.
- The published tarball is now `dist/` plus documentation only — the development
  workspace, examples and test files are excluded.

### v0.5.4 (2025/08/21 07:30 +00:00)
- [7e62656](https://github.com/clemb8/client-sf-oauth/commit/7e626562366536e91db8acd212e149e0b1766729) 0.5.4 (@clemb8)
- [e99ac71](https://github.com/clemb8/client-sf-oauth/commit/e99ac718a33c1ff662a4fe453db9f2c81add5e1f) Patch Dependencies (@clemb8)
- [#28](https://github.com/clemb8/client-sf-oauth/pull/28) Bump form-data from 4.0.0 to 4.0.4 (@clemb8)
- [8ee2c74](https://github.com/clemb8/client-sf-oauth/commit/8ee2c74930704b888b2d3c928b7ad04f94fc96e8) Bump form-data from 4.0.0 to 4.0.4 (@dependabot[bot])
- [#27](https://github.com/clemb8/client-sf-oauth/pull/27) Bump axios from 1.7.7 to 1.11.0 in /examples/WebApp (@clemb8)
- [f2be377](https://github.com/clemb8/client-sf-oauth/commit/f2be377fba7e84ef53005665ce415aa4ca724555) Bump axios from 1.7.7 to 1.11.0 in /examples/WebApp (@dependabot[bot])
- [#26](https://github.com/clemb8/client-sf-oauth/pull/26) Bump form-data from 4.0.0 to 4.0.4 in /examples/JWTandPass (@clemb8)
- [65f4b19](https://github.com/clemb8/client-sf-oauth/commit/65f4b19e6cf34afa3f0b796d3bb6d94e093ec07e) Bump form-data from 4.0.0 to 4.0.4 in /examples/JWTandPass (@dependabot[bot])
- [#25](https://github.com/clemb8/client-sf-oauth/pull/25) Bump path-to-regexp and express in /examples/WebApp (@clemb8)
- [ad3c0a9](https://github.com/clemb8/client-sf-oauth/commit/ad3c0a9b438f111f3d5bb4e0f9ab7badc0838c44) Merge branch 'main' into dependabot/npm_and_yarn/examples/WebApp/multi-6bc014718a (@clemb8)
- [#24](https://github.com/clemb8/client-sf-oauth/pull/24) Bump cookie and express in /examples/WebApp (@clemb8)
- [0958686](https://github.com/clemb8/client-sf-oauth/commit/09586861281fa53749f68e00a478999ed326c523) Bump path-to-regexp and express in /examples/WebApp (@dependabot[bot])
- [cfa5f33](https://github.com/clemb8/client-sf-oauth/commit/cfa5f3367c7e83ad451f8ced7cf360ec15953222) Bump cookie and express in /examples/WebApp (@dependabot[bot])
- [#23](https://github.com/clemb8/client-sf-oauth/pull/23) Bump axios from 1.6.7 to 1.7.7 in /examples/WebApp (@clemb8)
- [9446017](https://github.com/clemb8/client-sf-oauth/commit/9446017e1be5c1d3677ed14c3dd3f3e58f1a61df) Bump axios from 1.6.7 to 1.7.7 in /examples/WebApp (@dependabot[bot])
- [#20](https://github.com/clemb8/client-sf-oauth/pull/20) Bump send and express in /examples/WebApp (@clemb8)
- [#19](https://github.com/clemb8/client-sf-oauth/pull/19) Bump serve-static and express in /examples/WebApp (@clemb8)
- [5e97b84](https://github.com/clemb8/client-sf-oauth/commit/5e97b847aa2ca0b511806252889c7ff50099a9d1) Bump send and express in /examples/WebApp (@dependabot[bot])
- [d411aab](https://github.com/clemb8/client-sf-oauth/commit/d411aab71991dd3db4e642b5c572e710b6fccc77) Bump serve-static and express in /examples/WebApp (@dependabot[bot])
- [#18](https://github.com/clemb8/client-sf-oauth/pull/18) Bump express from 4.18.1 to 4.19.2 in /examples/WebApp (@clemb8)
- [ecff14d](https://github.com/clemb8/client-sf-oauth/commit/ecff14d77cd7b479708d0a980948278a647a9c25) Bump express from 4.18.1 to 4.19.2 in /examples/WebApp (@dependabot[bot])
- [#17](https://github.com/clemb8/client-sf-oauth/pull/17) Bump follow-redirects from 1.15.5 to 1.15.6 in /examples/js/pass (@clemb8)
- [#16](https://github.com/clemb8/client-sf-oauth/pull/16) Bump follow-redirects from 1.15.5 to 1.15.6 in /examples/JWTandPass (@clemb8)
- [#15](https://github.com/clemb8/client-sf-oauth/pull/15) Bump follow-redirects from 1.15.5 to 1.15.6 in /examples/WebApp (@clemb8)
- [#14](https://github.com/clemb8/client-sf-oauth/pull/14) Bump follow-redirects from 1.15.4 to 1.15.6 (@clemb8)
- [4fefdf0](https://github.com/clemb8/client-sf-oauth/commit/4fefdf088565353389c9d43fcaf61af353b9378e) Bump follow-redirects from 1.15.5 to 1.15.6 in /examples/js/pass (@dependabot[bot])
- [f9a83cb](https://github.com/clemb8/client-sf-oauth/commit/f9a83cb57f596c2efa189d696f1344fa9223bcd6) Bump follow-redirects from 1.15.5 to 1.15.6 in /examples/WebApp (@dependabot[bot])
- [94eb64a](https://github.com/clemb8/client-sf-oauth/commit/94eb64a7257d42f28779dcdfa0e90a1abcba5942) Bump follow-redirects from 1.15.5 to 1.15.6 in /examples/JWTandPass (@dependabot[bot])
- [01a198a](https://github.com/clemb8/client-sf-oauth/commit/01a198aa90ea16305085be4b310971c7b5ac15dd) Bump follow-redirects from 1.15.4 to 1.15.6 (@dependabot[bot])
- [#13](https://github.com/clemb8/client-sf-oauth/pull/13) Bump axios and client-sf-oauth in /examples/js/pass (@clemb8)
- [#12](https://github.com/clemb8/client-sf-oauth/pull/12) Bump axios and client-sf-oauth in /examples/WebApp (@clemb8)
- [#11](https://github.com/clemb8/client-sf-oauth/pull/11) Bump axios and client-sf-oauth in /examples/JWTandPass (@clemb8)
- [9dcff93](https://github.com/clemb8/client-sf-oauth/commit/9dcff93586b18d2534cb0ec1625704ce550ed1bb) Bump axios and client-sf-oauth in /examples/js/pass (@dependabot[bot])
- [085f619](https://github.com/clemb8/client-sf-oauth/commit/085f6190e0f77f5066a9aeece6beedda7c3a981c) Bump axios and client-sf-oauth in /examples/WebApp (@dependabot[bot])
- [47b4197](https://github.com/clemb8/client-sf-oauth/commit/47b4197613c4b38b0129d2fc8464916b7e4b1ddf) Bump axios and client-sf-oauth in /examples/JWTandPass (@dependabot[bot])
- [#10](https://github.com/clemb8/client-sf-oauth/pull/10) Bump follow-redirects from 1.15.2 to 1.15.4 in /examples/js/pass (@clemb8)
- [#9](https://github.com/clemb8/client-sf-oauth/pull/9) Bump follow-redirects from 1.15.2 to 1.15.4 (@clemb8)
- [#8](https://github.com/clemb8/client-sf-oauth/pull/8) Bump follow-redirects from 1.15.1 to 1.15.4 in /examples/WebApp (@clemb8)
- [#7](https://github.com/clemb8/client-sf-oauth/pull/7) Bump follow-redirects from 1.15.1 to 1.15.4 in /examples/JWTandPass (@clemb8)
- [0e95eb5](https://github.com/clemb8/client-sf-oauth/commit/0e95eb5b36d55fdef8f1edca397ab9dcae37cb14) Bump follow-redirects from 1.15.2 to 1.15.4 in /examples/js/pass (@dependabot[bot])
- [6d2b327](https://github.com/clemb8/client-sf-oauth/commit/6d2b327e0ff362b35c56a4eff9f5d26edcdd7b27) Bump follow-redirects from 1.15.2 to 1.15.4 (@dependabot[bot])
- [518f308](https://github.com/clemb8/client-sf-oauth/commit/518f30802e1bfd3d842dff6d5d99cc10ed791a29) Bump follow-redirects from 1.15.1 to 1.15.4 in /examples/WebApp (@dependabot[bot])
- [bb4400d](https://github.com/clemb8/client-sf-oauth/commit/bb4400da78a694bd1851f0063ff4d35f9c26dcfb) Bump follow-redirects from 1.15.1 to 1.15.4 in /examples/JWTandPass (@dependabot[bot])
- [8028065](https://github.com/clemb8/client-sf-oauth/commit/8028065fb4003ec82d7542933557233c77d2ee45) v 0.5.3 (@clemb8)
- [#4](https://github.com/clemb8/client-sf-oauth/pull/4) Bump jsonwebtoken and client-sf-oauth in /examples/js/pass (@clemb8)
- [#3](https://github.com/clemb8/client-sf-oauth/pull/3) Bump jsonwebtoken and client-sf-oauth in /examples/WebApp (@clemb8)
- [#2](https://github.com/clemb8/client-sf-oauth/pull/2) Bump axios from 0.27.2 to 1.6.0 (@clemb8)
- [#1](https://github.com/clemb8/client-sf-oauth/pull/1) Bump semver from 5.7.1 to 5.7.2 (@clemb8)
- [1b827e1](https://github.com/clemb8/client-sf-oauth/commit/1b827e1eebcee2fdf35e5f6a7ff3e68303b69e8d) Bump jsonwebtoken and client-sf-oauth in /examples/WebApp (@dependabot[bot])
- [35c1f29](https://github.com/clemb8/client-sf-oauth/commit/35c1f29e9348d9ebfcdac9fb747bbb4eb6b1f0f6) Bump jsonwebtoken and client-sf-oauth in /examples/js/pass (@dependabot[bot])
- [c01e44d](https://github.com/clemb8/client-sf-oauth/commit/c01e44dcb15b0aa957152bb58051d0d3071dda38) Bump axios from 0.27.2 to 1.6.0 (@dependabot[bot])
- [bd39bd2](https://github.com/clemb8/client-sf-oauth/commit/bd39bd21527fd74bd2eb307fe37c878e73363668) Bump semver from 5.7.1 to 5.7.2 (@dependabot[bot])
- [0641dfb](https://github.com/clemb8/client-sf-oauth/commit/0641dfbf6a9f8365b1e34cc6b37a067ed9122788) Add secret option for JWT (@clemb8)
- [419f4ce](https://github.com/clemb8/client-sf-oauth/commit/419f4ce0c48b7e5b008e38b0113c22e6c7d1e7ef) Publish new version (@clemb8)
- [15b45cf](https://github.com/clemb8/client-sf-oauth/commit/15b45cf29af59ec2ff3088eebca9dacfb7905cf5) Fix interfaxces (@clemb8)

### v0.4.1 (2023/02/06 19:20 +00:00)
- [ecae094](https://github.com/clemb8/client-sf-oauth/commit/ecae094bf5dca7c071817be85def74ca0a711095) 0.4.1 (@clemb8)
- [f305675](https://github.com/clemb8/client-sf-oauth/commit/f305675e92cb50a317fb207f0df6290a45cd8429) Bump jsonwebtoken (@clemb8)

### v0.4.0 (2023/02/04 16:21 +00:00)
- [94fdcca](https://github.com/clemb8/client-sf-oauth/commit/94fdcca772468706648236c5934ce13a819bef3a) 0.4.0 (@clemb8)
- [8282330](https://github.com/clemb8/client-sf-oauth/commit/8282330d228b12df3f80ef8cd3c0377872a934e2) fix pass connection (@clemb8)
- [f378521](https://github.com/clemb8/client-sf-oauth/commit/f378521a9287267bea51df578db764320bdc7b58) Fix typo readme (@clemb8)

### v0.3.0 (2022/08/31 20:08 +00:00)
- [b51c821](https://github.com/clemb8/client-sf-oauth/commit/b51c821941bac58c9bafbb6f13526838ae3e396a) 0.3.0 (@clemb8)
- [ff1dce9](https://github.com/clemb8/client-sf-oauth/commit/ff1dce9f57bae5373a35ccc8fe61e97a537e12d0) UsernamePassword as form url encoded (@clemb8)
- [7501dcb](https://github.com/clemb8/client-sf-oauth/commit/7501dcbcaa9a7c1c8a7345e43771cc006f8d79e4) clean (@clemb8)
- [3a73931](https://github.com/clemb8/client-sf-oauth/commit/3a73931b0a0cd5f491ab9c9dc7aaf630b4ec9291) patch version (@clemb8)
- [09bc76c](https://github.com/clemb8/client-sf-oauth/commit/09bc76cdd35972bfbe29fe0a4c2bab36b85c617b) update metadata (@clemb8)

### v0.2.1 (2022/08/23 15:28 +00:00)
- [1b19a84](https://github.com/clemb8/client-sf-oauth/commit/1b19a84163adfa660e10c4b7e29618a7ba0659ea) 0.2.1 (@clemb8)
- [bcfb7e0](https://github.com/clemb8/client-sf-oauth/commit/bcfb7e0089bf0e91f2572e030b3e09bf47482b7c) Adjust Readme (@clemb8)
- [51ff2da](https://github.com/clemb8/client-sf-oauth/commit/51ff2dae00342495399cc7299a5ec271be0c2f3b) examples (@clemb8)

### v0.2.0 (2022/08/23 15:24 +00:00)
- [14af8a5](https://github.com/clemb8/client-sf-oauth/commit/14af8a545b6190b4d9b582850e59c59e2bd092d3) 0.2.0 (@clemb8)
- [afe1028](https://github.com/clemb8/client-sf-oauth/commit/afe1028be24c36c22abd9bda4e45aef1bec2be33) Add Web App flow example (@clemb8)
- [145210f](https://github.com/clemb8/client-sf-oauth/commit/145210f39fc070710db758966b2d9d931c6f01ea) Add Webb App flow (@clemb8)
- [a1cfd9b](https://github.com/clemb8/client-sf-oauth/commit/a1cfd9b5c863497194ccfbae64d5ef176028ea8d) Reorganize examples (@clemb8)
- [c3e0011](https://github.com/clemb8/client-sf-oauth/commit/c3e00116781206ade3f386d8a96dde796eb7c4f0) Add WebApp Flow (@clemb8)
- [04de7c1](https://github.com/clemb8/client-sf-oauth/commit/04de7c113ba5ad726201d449b552f116f6804f5b) Add examples (@clemb8)
- [0b97ef1](https://github.com/clemb8/client-sf-oauth/commit/0b97ef16207400b605b49824403c41b59b181d46) new patch (@clemb8)
- [77ab60f](https://github.com/clemb8/client-sf-oauth/commit/77ab60f313c051d1e59c7775dd2363e8bef268e9) fix main file (@clemb8)
- [69348f3](https://github.com/clemb8/client-sf-oauth/commit/69348f3a9b1524b577e0674986d45642e00f07ff) patch (@clemb8)
- [ab57e6f](https://github.com/clemb8/client-sf-oauth/commit/ab57e6f334df6ed805bb44674d5e945ab5e41a4c) fix readme (@clemb8)
- [ea50a1d](https://github.com/clemb8/client-sf-oauth/commit/ea50a1d683eea5f9754e636dc1c6060c6d15607b) Add Readme (@clemb8)

### v0.1.0 (2022/08/22 16:38 +00:00)
- [0cbf47f](https://github.com/clemb8/client-sf-oauth/commit/0cbf47f7d1c6b5bcaad9ce6d15cdee7b5441e0ad) 0.1.0 (@clemb8)
- [736f626](https://github.com/clemb8/client-sf-oauth/commit/736f626cd8475aa48587ba9d74efca1837d23f16) Add Username Password Flow (@clemb8)
- [a9d3bd3](https://github.com/clemb8/client-sf-oauth/commit/a9d3bd34328e26a4ee424dc560205c749ca60559) fix passphrase option (@clemb8)
- [e84494c](https://github.com/clemb8/client-sf-oauth/commit/e84494c35cb163fa14bd92d4af1d833923749135) Setup project (@clemb8)