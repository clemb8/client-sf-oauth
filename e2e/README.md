# End-to-end tests

These talk to a **real Salesforce org with real credentials**. They are
separate from the unit suite on purpose: `npm test` must stay runnable with no
network and no credentials.

```
npm test          # unit suite — mocked, offline, always runs
npm run test:e2e  # this suite — live org, skips whatever it lacks credentials for
```

## Quick start

1. `cp .env.example .env`
2. Fill in one flow's variables (you do not need all three)
3. `npm run test:e2e`

Suites whose variables are absent **skip and say which variables are
missing**, by name. Nothing fails just because you have not configured a flow.

## What each suite proves

| Suite | Automated | Notes |
|---|---|---|
| `jwt.e2e.test.ts` | Fully | Mints a token, calls `userinfo` with it, revokes it |
| `password.e2e.test.ts` | **Skipped — deprecated** | See below; its security coverage lives in the unit suite |
| `webapp.e2e.test.ts` | Partly | The browser login step cannot be automated — see below |

The tests do more than check for a 200. Each successful flow calls
`/services/oauth2/userinfo` with the token it obtained, because a
token-shaped string in a response body proves nothing; Salesforce accepting
the token on a second call does. Every token a test mints is revoked in
teardown.

### The security assertions are the point

The unit suite proves error redaction against a *synthetic* axios rejection
built by `vi.mock`. These prove it against a real Salesforce 400 — a rejection
whose `config` genuinely carries the form body this library sent. That is
strictly stronger evidence, and it is why this suite is worth the setup:

- Failed requests must throw a redacted error carrying `status`, `error` and
  `errorDescription`, with **no** `config`, `request`, `response` or `cause`.
- No value from your `.env` may appear anywhere in the serialized error —
  checked across `message`, `stack`, `String()`, `util.inspect` and
  `JSON.stringify`.
- The JWT assertion must not survive into an error either. It is a bearer
  credential in its own right.
- The token exchange must send its parameters in a **request body**. An axios
  interceptor observes the real outbound request and asserts the client secret
  and the code never appear in the URL.

If a failure message names a variable, it is telling you that variable's value
leaked into an error. The message never prints the value itself.

## Org setup

You need a Salesforce Developer Edition org — free at
<https://developer.salesforce.com/signup>. One org can serve all three flows,
but the flows want different Connected App settings, so **three separate
Connected Apps is the simpler path**.

Setup → App Manager → New Connected App, in all cases with *Enable OAuth
Settings* checked and the scopes `api`, `refresh_token` and `openid`.

### JWT Bearer

1. Generate a key pair **outside this repository** (`*.pem` is gitignored, but
   do not rely on that):
   ```
   openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 \
     -keyout ~/sf-keys/server.key -out ~/sf-keys/server.crt \
     -subj "/CN=client-sf-oauth-e2e"
   ```
2. In the Connected App: check **Use digital signatures**, upload
   `server.crt`.
3. Manage → Edit Policies → Permitted Users =
   **Admin approved users are pre-authorized**.
4. Manage → Manage Profiles (or Permission Sets) → add your user's profile.
5. `SF_JWT_KEY_PATH=~/sf-keys/server.key` (expand the `~` — use an absolute
   path).

Connected App changes take a few minutes to propagate. A first run failing
with `invalid_client_id` usually just means "wait and retry".

### Username-Password (deprecated — usually not runnable)

**Salesforce is retiring this grant.** This suite is skipped by default. On
many orgs the enabling setting below no longer exists, so there is no
configuration that makes it pass, and a permanently red suite teaches everyone
to ignore red.

Its security coverage did not move anywhere risky: the `encodeURI`
form-injection regression and the error-redaction assertions both live in
`src/__tests__/UsernamePassword.test.ts` and run on every `npm test`, with no
org required.

To run it against an org that still permits the grant:

```
SF_PASS_RUN_DEPRECATED=1 npm run test:e2e
```

If your org does still permit it, you need all of:

- Setup → Identity → OAuth and OpenID Connect Settings →
  *Allow OAuth Username-Password Flows* enabled. **On newer orgs this setting
  is absent, and that is the end of the road** — it cannot be turned on.
- In the Connected App: Manage → Edit Policies → Permitted Users =
  *All users may self-authorize*.
- `SF_PASS_USERTOKEN`, your security token (Settings → Reset My Security
  Token). Unnecessary if you have relaxed the login IP ranges for your profile.

### Web Server

Set the Connected App's **Callback URL** to whatever you put in
`SF_WEB_REDIRECT_URI`. They must match exactly, including the scheme, port and
path. `http://localhost:3000/oauth/callback` is fine — Salesforce permits
plain HTTP for localhost.

## Why the Web Server flow is not fully automated

Its middle step is a human logging in to Salesforce in a browser and granting
consent. There is no headless substitute that does not amount to scripting a
login form against a live identity provider — brittle, and a credential-handling
liability in a repository whose entire subject is credential handling.

So the suite tests the halves that are machine-verifiable: that the authorize
URL is one Salesforce accepts, that special characters in forwarded parameters
are encoded, that the token exchange puts its parameters in the body, and that
a bad code fails safely.

To exercise the full round trip once, by hand:

1. Let the library build the authorize URL, because every authorize request
   it sends carries a PKCE `S256` challenge and the code you get back can only
   be redeemed with the matching verifier. With your `.env` filled in
   (`dist/` exists after `npm ci`):
   ```
   node --env-file=.env -e "
   const { SF_WebAppConnect } = require('./dist');
   const client = new SF_WebAppConnect({ host: process.env.SF_WEB_HOST, clientId: process.env.SF_WEB_CLIENT_ID, clientSecret: process.env.SF_WEB_CLIENT_SECRET, redirectURI: process.env.SF_WEB_REDIRECT_URI });
   client.requestAuthCode().then((url) => { console.log('Open:', url); console.log('SF_WEB_CODE_VERIFIER=' + client.codeVerifier); });
   "
   ```
2. Open the printed URL, log in, approve.
3. You land on your redirect URI with `?code=...` in the query string. Copy
   that value.
4. Put it in `SF_WEB_AUTH_CODE`, put the printed verifier in
   `SF_WEB_CODE_VERIFIER`, and re-run within ~15 minutes.

The code is single-use. Re-running the test again with the same value will
correctly fail with `invalid_grant`. The verifier is a secret for as long as
the code is valid: clear both variables afterwards.

## Safety notes

- **`.env` is gitignored.** So are `*.pem` and `*.key`. Verify with
  `git status` before committing anything.
- **Keep the private key outside the repository.** A gitignore rule is a
  safety net, not a boundary.
- **Use a Developer Edition org, never production.** These tests
  authenticate repeatedly and deliberately trigger failed logins, which can
  count against lockout thresholds.
- **Tokens are revoked in teardown**, but a crashed run may leave one valid.
  Setup → Connected Apps OAuth Usage → Revoke if you want to be sure.
- **Nothing here logs a credential.** Assertions compare against values and
  report variable *names* on failure.

## Troubleshooting

| Error | Usually means |
|---|---|
| `invalid_client_id` | Consumer Key wrong, or the app has not propagated yet — wait a few minutes |
| `invalid_grant` on JWT | User not pre-authorized on the app, or the certificate does not match the key |
| `invalid_grant` on password | Wrong password, a missing security token, or the grant is disabled org-wide — the flow is deprecated and usually not runnable |
| `redirect_uri_mismatch` | The Callback URL and `SF_WEB_REDIRECT_URI` differ |
| Suite skipped unexpectedly | A variable is empty. The skip reason names which. |
