# client-sf-oauth

Get a Salesforce access token from Node.js with OAuth 2.0 — JWT bearer, web-server (authorization code) with PKCE, or username-password — in TypeScript with typed parameters.

[![npm version](https://img.shields.io/npm/v/client-sf-oauth)](https://www.npmjs.com/package/client-sf-oauth)
[![npm downloads](https://img.shields.io/npm/dm/client-sf-oauth)](https://www.npmjs.com/package/client-sf-oauth)
[![license](https://img.shields.io/npm/l/client-sf-oauth)](https://github.com/clemb8/client-sf-oauth/blob/main/License.txt)
[![node](https://img.shields.io/node/v/client-sf-oauth)](https://github.com/clemb8/client-sf-oauth#install)

The library does one thing: it turns a Connected App configuration plus a
credential (a certificate, a browser login, or a password) into a Salesforce
token response. It does not call the Salesforce data APIs, refresh tokens, or
manage sessions — use the token it returns with any Salesforce REST, Bulk, or
Tooling client.

## Table of contents

- [Install](#install)
- [Which flow?](#which-flow)
- [Quick start: JWT bearer](#quick-start-jwt-bearer)
- [Quick start: Web server flow with PKCE](#quick-start-web-server-flow-with-pkce)
- [Quick start: Username/password (deprecated)](#quick-start-usernamepassword-deprecated)
- [API reference](#api-reference)
- [Errors](#errors)
- [Examples](#examples)
- [Security](#security)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

## Install

```bash
npm install client-sf-oauth
```

- **Node.js 20 or newer** (`engines.node >=20`). npm prints a warning on older
  versions; the install still proceeds unless `engine-strict` is set.
- **Module format: CommonJS** (`main: dist/index.js`) with bundled TypeScript
  declarations (`types: dist/index.d.ts`). No build step is needed on your side.
- **Importing** — three shapes, depending on how your project is built:

  ```ts
  // TypeScript compiled to CommonJS (`module: commonjs`, or `node16`/`nodenext`
  // with CommonJS output) — the shape every sample in this README uses.
  import { SF_JWTConnect, SF_WebAppConnect, SF_PassConnect } from 'client-sf-oauth';
  ```

  ```javascript
  // Plain CommonJS JavaScript
  const { SF_JWTConnect, SF_WebAppConnect, SF_PassConnect } = require('client-sf-oauth');
  ```

  ```javascript
  // Native ESM (a `.mjs` file, or `"type": "module"` in package.json):
  // import the default export and destructure it.
  import pkg from 'client-sf-oauth';
  const { SF_JWTConnect, SF_WebAppConnect, SF_PassConnect } = pkg;
  ```

  **Named ESM imports are not available in 0.7.x.** In native ESM,
  `import { SF_JWTConnect } from 'client-sf-oauth'` fails with
  `SyntaxError: Named export 'SF_JWTConnect' not found`.
  The package ships CommonJS only, with no `exports` map or ESM build, and the
  getter-style re-exports `tsc` emits are not detected by Node's CommonJS
  export lexer. Use the default import above from native ESM.

The package ships `dist/` (JavaScript plus `.d.ts`), this README, `CHANGELOG.md`,
`License.txt`, and two machine-readable guides for AI coding assistants,
`llms.txt` and `AGENTS.md`. Runtime dependencies: `axios` and `jsonwebtoken`.

## Which flow?

| If you are | Use | Grant |
|---|---|---|
| A backend service, scheduled job, CLI, or integration with no user present | **`SF_JWTConnect`** — a certificate registered on the Connected App replaces any password | `urn:ietf:params:oauth:grant-type:jwt-bearer` |
| A web application where a user logs in through the browser | **`SF_WebAppConnect`** — the user authenticates with Salesforce directly; your app never sees their password. PKCE (`S256`) is on by default | `authorization_code` |
| Stuck with a legacy org that still permits it | `SF_PassConnect` — **deprecated**, see [below](#quick-start-usernamepassword-deprecated) | `password` |

Two rules apply to every flow:

> **Never log a caught error object wholesale.** The library redacts what it
> throws — an error carries the HTTP status plus Salesforce's `error` and
> `error_description`, and never the request body, URL, or headers — so log
> `error.message`, not the object you happened to catch.

> **`host` must be an absolute `https:` URL** (`https://login.salesforce.com`,
> `https://test.salesforce.com`, or your My Domain). A trailing slash is
> optional. `http:` is rejected before any network call.

Salesforce's own guide to these flows:
[Authorize Apps with OAuth](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_authenticate.htm&type=5).

## Quick start: JWT bearer

Prerequisites on the Salesforce side: a Connected App with *Use digital
signatures* enabled and your certificate uploaded, and the user
pre-authorized on the app (Manage → Edit Policies → *Admin approved users are
pre-authorized*). The private key stays on your server.

```ts
import { SF_JWTConnect, JWTParameters } from 'client-sf-oauth';

const parameters: JWTParameters = {
  clientId: process.env.SF_CLIENT_ID!,          // Connected App consumer key
  username: process.env.SF_USERNAME!,           // the user the token is issued for
  secret: process.env.SF_PRIVATE_KEY_PATH!,     // path to the PEM private key
  // secretText: true,                          // ...or pass the key text itself in `secret`
  // environment: 'dev',                        // sandbox: token endpoint becomes test.salesforce.com
};

async function main(): Promise<void> {
  try {
    const client = new SF_JWTConnect(parameters);
    // Signs an RS256 assertion and exchanges it in one call. The passphrase is
    // only needed when the private key is encrypted.
    const response = await client.createJWTAndGetAccessToken(process.env.SF_PRIVATE_KEY_PASSPHRASE);

    const accessToken: string = response.data.access_token;
    const instanceUrl: string = response.data.instance_url;
    console.log('Token issued for', instanceUrl);   // never log accessToken
    // Use `Authorization: Bearer ${accessToken}` against `${instanceUrl}/services/data/...`
  } catch (error) {
    // The error is redacted; its message is safe to log. The object is not.
    console.error('JWT bearer login failed:', error instanceof Error ? error.message : String(error));
  }
}

main();
```

Sandbox orgs: set `environment: 'dev'` and the audience and token endpoint
switch to `https://test.salesforce.com`. Any other value (or none) targets
`https://login.salesforce.com`.

## Quick start: Web server flow with PKCE

The web server flow is **two HTTP requests to your application**, and the two
values that bind them — the PKCE `codeVerifier` and the CSRF `state` — must be
stored **per user session** in between. Salesforce requires PKCE by default on
Connected Apps created since Winter '23; the library generates the pair for
you and never puts the verifier in a URL.

Prerequisites: a Connected App whose *Callback URL* is exactly your
`redirectURI` (scheme, host, port, and path).

```ts
import { randomBytes } from 'node:crypto';
import { SF_WebAppConnect, WebAuthCodeParameters } from 'client-sf-oauth';

const parameters: WebAuthCodeParameters = {
  host: process.env.SF_HOST ?? 'https://login.salesforce.com',
  clientId: process.env.SF_CLIENT_ID!,
  clientSecret: process.env.SF_CLIENT_SECRET!,
  redirectURI: process.env.SF_REDIRECT_URI!,    // must match the Connected App callback URL exactly
};

/** What your session store keeps for one user between the two requests. */
interface PendingAuthorization {
  state: string;         // single-use CSRF token
  codeVerifier: string;  // PKCE secret — server-side only, never in a browser-readable cookie
}

/**
 * Request 1 — the user clicks "Log in with Salesforce".
 * Save `pending` in the user's session, then redirect the browser to `redirectTo`.
 */
async function beginLogin(): Promise<{ redirectTo: string; pending: PendingAuthorization }> {
  // `state` is a constructor parameter, so build one client per authorization.
  const state = randomBytes(16).toString('base64url');
  const client = new SF_WebAppConnect({ ...parameters, state });

  // Builds the authorize URL (with an S256 code challenge), follows Salesforce's
  // redirects, and resolves to the URL to send the user's browser to.
  const redirectTo = await client.requestAuthCode();

  return { redirectTo, pending: { state, codeVerifier: client.codeVerifier! } };
}

/**
 * Request 2 — Salesforce redirects the browser to `redirectURI?code=...&state=...`.
 * Load `pending` from the session and delete it BEFORE redeeming the code, so a
 * replayed callback finds nothing.
 */
async function finishLogin(
  query: { code?: string; state?: string },
  pending: PendingAuthorization | undefined,
): Promise<{ accessToken: string; instanceUrl: string }> {
  // CSRF check: the callback must carry the state this server issued.
  if (pending === undefined || query.code === undefined || query.state !== pending.state) {
    throw new Error('Callback does not match an authorization this server started.');
  }

  const client = new SF_WebAppConnect(parameters);
  // The verifier travels in the request body alongside the client secret.
  const response = await client.requestAccessTokenWithCode(query.code, pending.codeVerifier);

  return {
    accessToken: response.data.access_token,
    instanceUrl: response.data.instance_url,
  };
}

export { beginLogin, finishLogin };
```

Wire `beginLogin` to your login route and `finishLogin` to the callback route
with whatever session middleware you use. A complete Express 5 application
with an in-memory pending-authorization store is in
[`examples/WebApp`](https://github.com/clemb8/client-sf-oauth/tree/main/examples/WebApp).

If you manage your own PKCE pair, pass `code_verifier` (the challenge is
derived from it) or `code_challenge` + `code_challenge_method` to the
constructor, and pass the verifier to `requestAccessTokenWithCode` yourself.
A single long-lived instance in a script needs neither: it reuses its own
verifier automatically.

## Quick start: Username/password (deprecated)

**Salesforce is retiring this grant.** It is disabled by default on new orgs,
and on many orgs the *Allow OAuth Username-Password Flows* setting no longer
exists at all — so it cannot be enabled there by any configuration.

It is also the weakest of the three: it sends a user's password and security
token on every call, it cannot support multi-factor authentication, and it
leaves your application holding a human credential rather than a scoped token.
Prefer `SF_JWTConnect` for server-to-server work, or `SF_WebAppConnect` when a
user is present.

`SF_PassConnect` still works where an org permits the grant, carries the same
security fixes as the other two flows, and is **not scheduled for removal from
this library**. The class is marked `@deprecated`, so editors flag it; the
deprecation reflects Salesforce's direction, not ours.

```ts
import { SF_PassConnect, PassParameters } from 'client-sf-oauth';

const parameters: PassParameters = {
  host: process.env.SF_HOST ?? 'https://login.salesforce.com',
  clientId: process.env.SF_CLIENT_ID!,
  clientSecret: process.env.SF_CLIENT_SECRET!,
  username: process.env.SF_USERNAME!,
  password: process.env.SF_PASSWORD!,
  usertoken: process.env.SF_SECURITY_TOKEN ?? '',   // empty when your IP range is allowlisted
};

async function main(): Promise<void> {
  try {
    const client = new SF_PassConnect(parameters);
    const response = await client.requestAccessToken();
    console.log('Token issued for', response.data.instance_url);
  } catch (error) {
    console.error('Password login failed:', error instanceof Error ? error.message : String(error));
  }
}

main();
```

In plain JavaScript:

```javascript
const { SF_PassConnect } = require('client-sf-oauth');

async function main() {
  const client = new SF_PassConnect({
    host: process.env.SF_HOST || 'https://login.salesforce.com',
    clientId: process.env.SF_CLIENT_ID,
    clientSecret: process.env.SF_CLIENT_SECRET,
    username: process.env.SF_USERNAME,
    password: process.env.SF_PASSWORD,
    usertoken: process.env.SF_SECURITY_TOKEN || '',
  });
  try {
    const response = await client.requestAccessToken();
    console.log('Token issued for', response.data.instance_url);
  } catch (error) {
    console.error('Password login failed:', error && error.message ? error.message : error);
  }
}

main();
```

## API reference

The entry point exports exactly seven names: three classes and four parameter
interfaces.

| Export | Kind | Used by |
|---|---|---|
| `SF_JWTConnect` | class | JWT bearer flow |
| `SF_WebAppConnect` | class | Web server (authorization code) flow with PKCE |
| `SF_PassConnect` | class (`@deprecated`) | Username-password flow |
| `JWTParameters` | interface | `new SF_JWTConnect(parameters)` |
| `WebAuthCodeParameters` | interface | `new SF_WebAppConnect(parameters)` |
| `PassParameters` | interface | `new SF_PassConnect(parameters)` |
| `WebAppParameters` | interface | Base of `WebAuthCodeParameters` (`clientId`, `clientSecret`, `host`, `redirectURI`) |

Every constructor validates its input **before** any network or filesystem
access and throws on a missing, empty, non-string, or non-`https:` value. Every
network method returns the `AxiosResponse` from the token endpoint; the
Salesforce JSON is `response.data` (see [Token response](#token-response)).

### SF_JWTConnect

Constructor: `new SF_JWTConnect(parameters: JWTParameters)`

| Parameter | Type | Required | Meaning | Default |
|---|---|---|---|---|
| `clientId` | `string` | yes | Connected App consumer key (the `iss` claim) | — |
| `username` | `string` | yes | Salesforce username the token is issued for (the `sub` claim) | — |
| `secret` | `string` | yes | Path to the PEM private key — or the key text itself when `secretText` is `true` | — |
| `secretText` | `boolean` | no | Treat `secret` as key material rather than a file path | `false` (read the file) |
| `expiration` | `number` | no | The `exp` claim, in epoch **seconds** | now + 3600 s |
| `environment` | `string` | no | `'dev'` targets `https://test.salesforce.com`; anything else targets `https://login.salesforce.com` | production login host |

| Method | Returns | What it does |
|---|---|---|
| `createJWT(passphrase?: string)` | `string` | Signs the RS256 assertion (`iss`, `sub`, `aud`, `exp`). `passphrase` decrypts an encrypted private key |
| `requestAccessToken(jwt: string)` | `Promise<AxiosResponse>` | POSTs `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` and `assertion` to `<audience>/services/oauth2/token` |
| `createJWTAndGetAccessToken(passphrase?: string)` | `Promise<AxiosResponse>` | The two steps above in one call |

A key file that cannot be read throws before any network access; the error
names the parameter and the errno code, never the path or the key.

### SF_WebAppConnect

Constructor: `new SF_WebAppConnect(parameters: WebAuthCodeParameters)`

| Parameter | Type | Required | Meaning | Default |
|---|---|---|---|---|
| `host` | `string` | yes | Absolute `https:` login host; trailing slash optional | — |
| `clientId` | `string` | yes | Connected App consumer key | — |
| `clientSecret` | `string` | yes | Connected App consumer secret. Sent only in the token-exchange request body | — |
| `redirectURI` | `string` | yes | Callback URL, matched exactly against the Connected App | — |
| `state` | `string` | no | Opaque value Salesforce echoes back on the callback; use it as the CSRF check | — |
| `scope` | `string` | no | Space-separated scopes to request | Connected App defaults |
| `code_verifier` | `string` | no | A PKCE verifier you persisted; its `S256` challenge is derived for you. Never placed in a URL | generated |
| `code_challenge` | `string` | no | Your own PKCE challenge; you then own the verifier and must pass it to `requestAccessTokenWithCode` | derived from the verifier |
| `code_challenge_method` | `string` | no | `S256` or `plain` (`plain` offers no protection) | `S256` |
| `immediate` | `boolean` | no | Forwarded to the authorize request | — |
| `display`, `login_hint`, `nonce`, `prompt` | `string` | no | Forwarded to the authorize request, percent-encoded | — |

| Member | Returns | What it does |
|---|---|---|
| `codeVerifier` (getter) | `string \| undefined` | The PKCE verifier bound to the last `requestAuthCode()` call, or the one supplied at construction. `undefined` before the first authorize request. Treat it as a credential |
| `requestAuthCode()` | `Promise<string>` | Builds `<host>/services/oauth2/authorize?client_id&redirect_uri&response_type=code&code_challenge&code_challenge_method[&state&scope&...]`, performs the request server-side following Salesforce's redirects, and resolves to the URL to send the user's browser to |
| `requestAccessTokenWithCode(code: string, codeVerifier?: string)` | `Promise<AxiosResponse>` | POSTs `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `redirect_uri`, and `code_verifier` in the request body. An explicit `codeVerifier` wins over the instance's own; pass it whenever the callback is a different request from the authorize step |

### SF_PassConnect (deprecated)

Constructor: `new SF_PassConnect(parameters: PassParameters)`

| Parameter | Type | Required | Meaning | Default |
|---|---|---|---|---|
| `host` | `string` | yes | Absolute `https:` login host; trailing slash optional | — |
| `clientId` | `string` | yes | Connected App consumer key | — |
| `clientSecret` | `string` | yes | Connected App consumer secret | — |
| `username` | `string` | yes | Salesforce username | — |
| `password` | `string` | yes | Salesforce password only — the security token goes in `usertoken` | — |
| `usertoken` | `string` | declared required; pass `''` when your IP range is allowlisted | Security token, appended to the password before form-encoding | `''` |

| Method | Returns | What it does |
|---|---|---|
| `requestAccessToken()` | `Promise<AxiosResponse>` | POSTs `grant_type=password` with `client_id`, `client_secret`, `username`, and `password` + `usertoken` to `<host>/services/oauth2/token` |

### Token response

Every token method resolves to the `AxiosResponse` of the token endpoint. The
Salesforce token JSON is `response.data`, which is typed `any` in 0.7.x (the
library declares no token type yet). The fields Salesforce returns:

| Field in `response.data` | Meaning |
|---|---|
| `access_token` | The bearer token. Send it as `Authorization: Bearer <access_token>` |
| `instance_url` | Base URL of the org's API, e.g. `https://myorg.my.salesforce.com` |
| `id` | Identity URL of the user the token belongs to |
| `token_type` | `Bearer` |
| `issued_at` | Issue time, epoch milliseconds as a string |
| `signature` | Base64 HMAC-SHA256 of `id` + `issued_at`, keyed with the consumer secret |
| `scope` | Granted scopes (web server flow) |

`response.status` is the HTTP status (200 on success). Treat `access_token` as a
credential: never log the whole `response` or `response.data`.

## Errors

Every error the library throws has a message that starts with `client-sf-oauth:`
and carries **no credential material**: nothing on it derives from the request
body, URL, or headers, and the original transport rejection is deliberately not
attached as `cause`.

Network failures reject with an error carrying:

| Property | Meaning |
|---|---|
| `message` | Human-readable summary, safe to log |
| `status` | HTTP status, when Salesforce responded |
| `error` | Salesforce's `error` field, e.g. `invalid_grant` |
| `errorDescription` | Salesforce's `error_description` field |
| `code` | Transport code when no response arrived, e.g. `ECONNREFUSED` |

Invalid constructor input throws before any network or filesystem access with
a `field` property naming the offending parameter; the message never echoes
the value. A malformed PKCE verifier and a non-object `parameters` argument
throw a `TypeError`.

In 0.7.x the error classes (`OAuthRequestError`, `InvalidParameterError`) are
**not exported from the entry point**, so match on properties rather than
`instanceof`:

```ts
import { SF_JWTConnect } from 'client-sf-oauth';

interface OAuthFailure extends Error {
  status?: number;
  error?: string;
  errorDescription?: string;
  code?: string;
  field?: string;
}

function isLibraryError(value: unknown): value is OAuthFailure {
  return value instanceof Error && value.message.startsWith('client-sf-oauth:');
}

async function login(client: SF_JWTConnect): Promise<string> {
  try {
    const response = await client.createJWTAndGetAccessToken();
    return response.data.access_token;
  } catch (error) {
    if (isLibraryError(error) && error.error === 'invalid_grant') {
      // Wrong user, user not pre-authorized on the app, or expired assertion.
      throw new Error(`Salesforce refused the login: ${error.errorDescription ?? error.message}`);
    }
    throw error;
  }
}

export { login };
```

## Examples

Three runnable projects live under `examples/` in the repository (they are not
part of the npm package):

- [`examples/JWTandPass`](https://github.com/clemb8/client-sf-oauth/tree/main/examples/JWTandPass) — TypeScript scripts for the JWT bearer flow and the deprecated password flow, with key-pair generation instructions.
- [`examples/WebApp`](https://github.com/clemb8/client-sf-oauth/tree/main/examples/WebApp) — an Express 5 application running the web server flow with per-request PKCE and a single-use `state` check.
- [`examples/js/pass`](https://github.com/clemb8/client-sf-oauth/tree/main/examples/js/pass) — the password flow from plain CommonJS JavaScript.

## Security

See [`SECURITY.md`](https://github.com/clemb8/client-sf-oauth/blob/main/SECURITY.md)
for supported versions, how to report a vulnerability privately, and the
credential-handling guarantees the library makes (input validation before I/O,
`https:`-only hosts, body-only credential transport, redacted errors).

## Contributing

See [`CONTRIBUTING.md`](https://github.com/clemb8/client-sf-oauth/blob/main/CONTRIBUTING.md):
Node 20+, `npm ci`, `npm test`, `npm run lint`, and how to run the end-to-end
suite against a Developer Edition org.

## Changelog

See [`CHANGELOG.md`](https://github.com/clemb8/client-sf-oauth/blob/main/CHANGELOG.md).
The 0.7.0 entry documents the PKCE addition, the error-redaction change, and
the constructor validation that upgraders should read before moving from 0.5.x.

## License

MIT — see [`License.txt`](https://github.com/clemb8/client-sf-oauth/blob/main/License.txt).
