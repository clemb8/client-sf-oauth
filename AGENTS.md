# AGENTS.md — using `client-sf-oauth` from generated code

This file is for a coding agent that is **consuming** this package on a
developer's behalf. It tells you which flow to pick, exactly how to wire it,
and what never to do with the credentials involved. Contributor instructions
are in `CONTRIBUTING.md`; the full API reference is in `README.md`; a compact
machine summary is in `llms.txt`.

Package facts you can rely on for 0.7.x: CommonJS, Node `>=20`, bundled
`.d.ts`, seven exports (`SF_JWTConnect`, `SF_WebAppConnect`, `SF_PassConnect`,
`JWTParameters`, `WebAuthCodeParameters`, `PassParameters`, `WebAppParameters`).
Nothing else is importable from the entry point.

## 1. Choose the flow

| Situation | Use | Do not use |
|---|---|---|
| No human present: backend service, job, CLI, integration | `SF_JWTConnect` | `SF_PassConnect` |
| A human logs in through a browser | `SF_WebAppConnect` | `SF_PassConnect` |
| The developer explicitly asks for username/password and their org still permits it | `SF_PassConnect`, and say it is deprecated | — |

`SF_PassConnect` is `@deprecated`: Salesforce is retiring the grant, it is
disabled by default on new orgs, and it cannot support MFA. Do not choose it
by default. It is not scheduled for removal from the library, so existing code
that uses it keeps working.

## 2. Wire the JWT bearer flow

```ts
import { SF_JWTConnect, JWTParameters } from 'client-sf-oauth';

const parameters: JWTParameters = {
  clientId: process.env.SF_CLIENT_ID!,        // Connected App consumer key
  username: process.env.SF_USERNAME!,         // user the token is issued for; must be pre-authorized on the app
  secret: process.env.SF_PRIVATE_KEY_PATH!,   // path to the PEM private key
  // secretText: true,                        // set this if `secret` holds the key text, not a path
  // environment: 'dev',                      // sandbox orgs: test.salesforce.com
};

export async function getSalesforceToken(): Promise<{ accessToken: string; instanceUrl: string }> {
  const client = new SF_JWTConnect(parameters);
  const response = await client.createJWTAndGetAccessToken(process.env.SF_PRIVATE_KEY_PASSPHRASE);
  return { accessToken: response.data.access_token, instanceUrl: response.data.instance_url };
}
```

- `createJWTAndGetAccessToken(passphrase?)` signs the RS256 assertion and
  exchanges it in one call. Pass a passphrase only for an encrypted key.
- There is no `host` parameter: the audience is `https://login.salesforce.com`,
  or `https://test.salesforce.com` when `environment` is `'dev'`.
- The token is short-lived and the library does not refresh it. Call again when
  Salesforce answers 401.

## 3. Wire the web server flow with PKCE

Two HTTP requests hit the application. Persist two values **per user session**
between them: `state` and `codeVerifier`.

```ts
import { randomBytes } from 'node:crypto';
import { SF_WebAppConnect, WebAuthCodeParameters } from 'client-sf-oauth';

const parameters: WebAuthCodeParameters = {
  host: process.env.SF_HOST ?? 'https://login.salesforce.com',
  clientId: process.env.SF_CLIENT_ID!,
  clientSecret: process.env.SF_CLIENT_SECRET!,
  redirectURI: process.env.SF_REDIRECT_URI!,   // must equal the Connected App callback URL exactly
};

export interface PendingAuthorization {
  state: string;
  codeVerifier: string;
}

/** Request 1: store `pending` in the user's session, redirect the browser to `redirectTo`. */
export async function beginLogin(): Promise<{ redirectTo: string; pending: PendingAuthorization }> {
  const state = randomBytes(16).toString('base64url');
  const client = new SF_WebAppConnect({ ...parameters, state });   // one client per authorization
  const redirectTo = await client.requestAuthCode();
  return { redirectTo, pending: { state, codeVerifier: client.codeVerifier! } };
}

/** Request 2: the callback. Remove `pending` from the session before calling this. */
export async function finishLogin(
  query: { code?: string; state?: string },
  pending: PendingAuthorization | undefined,
): Promise<{ accessToken: string; instanceUrl: string }> {
  if (pending === undefined || query.code === undefined || query.state !== pending.state) {
    throw new Error('Callback does not match an authorization this server started.');
  }
  const client = new SF_WebAppConnect(parameters);
  const response = await client.requestAccessTokenWithCode(query.code, pending.codeVerifier);
  return { accessToken: response.data.access_token, instanceUrl: response.data.instance_url };
}
```

Rules that are not optional:

- **`state` is single-use.** Generate it with `crypto.randomBytes`, pass it to
  the constructor, store it with the session, compare it on the callback, and
  delete it before redeeming the code. A missing, unknown, or reused `state`
  means the callback is not yours: reject it.
- **Persist `codeVerifier` server-side** (session store, database), never in a
  cookie the browser can read, never in a log. Read it from
  `client.codeVerifier` after `requestAuthCode()` resolves.
- **Never put the verifier in the authorize URL.** The library excludes it; do
  not add it as a query parameter yourself.
- **Pass the verifier to `requestAccessTokenWithCode(code, codeVerifier)`** in
  the callback. The callback is a different request, so the client instance
  that generated the pair is gone; a fresh instance with the verifier argument
  is the correct pattern.
- `requestAuthCode()` performs the authorize request server-side and resolves
  to the URL Salesforce landed on. Redirect the user's browser to that URL; do
  not fetch it again.
- If the developer supplies their own PKCE pair, pass `code_verifier` (the
  challenge is derived) or `code_challenge` + `code_challenge_method`, and pass
  that verifier to the exchange yourself.

## 4. Credential rules

- **Never log the caught error object.** Log `error.message` only. The library
  redacts what it throws, but a logger that serializes the whole object is the
  habit to avoid.
- **Never log `response` or `response.data`.** They carry `access_token`.
- **Never commit a key, secret, or `.env` file.** Read every credential from
  the environment or a secret manager; keep the PEM private key outside the
  repository.
- **`host` must be an absolute `https:` URL.** `http:` is rejected before any
  network call. Use `https://login.salesforce.com`,
  `https://test.salesforce.com`, or the org's My Domain.
- **Every constructor validates before I/O.** A missing, empty, non-string, or
  non-`https:` value throws an error naming the parameter and never echoing
  the value. Do not wrap constructors in code that swallows the error.

## 5. Where the token is

Every token method resolves to the `AxiosResponse` of the token endpoint.
`response.status` is the HTTP status; `response.data` is Salesforce's token
JSON, typed `any` in 0.7.x:

| Field | Meaning |
|---|---|
| `response.data.access_token` | Bearer token: `Authorization: Bearer <access_token>` |
| `response.data.instance_url` | Base URL for API calls |
| `response.data.id` | Identity URL of the user |
| `response.data.token_type` | `Bearer` |
| `response.data.issued_at` | Epoch milliseconds, as a string |
| `response.data.signature` | HMAC of `id` + `issued_at`, keyed with the consumer secret |
| `response.data.scope` | Granted scopes (web server flow) |

Annotate the two fields you use (`const accessToken: string = response.data.access_token`)
rather than propagating `any`.

## 6. Handle errors

- Every message starts with `client-sf-oauth:`.
- Network failures: `status?`, `error?` (Salesforce `error`, e.g.
  `invalid_grant`), `errorDescription?`, `code?` (e.g. `ECONNREFUSED`).
- Constructor validation failures: `field` names the parameter.
- A non-object `parameters` argument or a malformed PKCE verifier throws a
  `TypeError`.
- **The error classes are not exported from the entry point in 0.7.x.** Do not
  generate `import { OAuthRequestError } from 'client-sf-oauth'` or an
  `instanceof OAuthRequestError` check; it will not compile. Match on
  `error instanceof Error && error.message.startsWith('client-sf-oauth:')` and
  read the properties above, as in the `README.md` Errors section.

## 7. Deprecated password flow, if you must

```ts
import { SF_PassConnect, PassParameters } from 'client-sf-oauth';

const parameters: PassParameters = {
  host: process.env.SF_HOST ?? 'https://login.salesforce.com',
  clientId: process.env.SF_CLIENT_ID!,
  clientSecret: process.env.SF_CLIENT_SECRET!,
  username: process.env.SF_USERNAME!,
  password: process.env.SF_PASSWORD!,          // password only
  usertoken: process.env.SF_SECURITY_TOKEN ?? '', // security token; '' when the IP range is allowlisted
};

export async function getSalesforceTokenWithPassword(): Promise<string> {
  const client = new SF_PassConnect(parameters);   // editors flag this as deprecated; that is expected
  const response = await client.requestAccessToken();
  return response.data.access_token;
}
```

Tell the developer it is deprecated and point them to the JWT bearer or web
server flow.
