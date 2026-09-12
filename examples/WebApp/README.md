# Web server flow example (Express 5, PKCE, single-use `state`)

This example demonstrates **`SF_WebAppConnect`** — the OAuth 2.0 web server
(authorization code) flow with PKCE — in a minimal Express 5 application. It
is the pattern the root [README](../../README.md#quick-start-web-server-flow-with-pkce)
describes, made runnable.

What it shows:

- one `SF_WebAppConnect` per authorization, so each user gets their own PKCE
  pair and their own `state`;
- the PKCE `codeVerifier` and the `state` persisted server-side between the
  authorize redirect (`GET /oauth`) and the callback (`GET /getAccessToken`);
- a single-use, expiring `state` check before the code is redeemed (the CSRF
  protection of the authorization-code flow);
- the verifier passed explicitly to `requestAccessTokenWithCode(code, verifier)`
  in the callback, because the callback is a different HTTP request.

The in-memory `Map` stands in for a session store; a real application uses
session middleware or a shared store.

## Environment variables

| Variable | Description |
|---|---|
| `clientId` | Connected App consumer key |
| `clientSecret` | Connected App consumer secret |
| `redirectUri` | Must equal the Connected App callback URL exactly, e.g. `http://localhost:3000/getAccessToken` |
| `host` | Login host, e.g. `https://login.salesforce.com` — must be `https:` |

## Run

```bash
npm install
npx tsc index.ts --esModuleInterop --target es2022 --module commonjs --strict --skipLibCheck
node index.js
```

Then open <http://localhost:3000/>. `index.html` is a static landing page you
can serve in front of the app if you want one; the app itself redirects `/` to
`/oauth`.

The root [README](../../README.md) has the full API reference; the flow
selection guide is in its [Which flow?](../../README.md#which-flow) section.
