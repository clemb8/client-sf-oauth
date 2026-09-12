# Username-password flow example (plain JavaScript)

This example demonstrates **`SF_PassConnect`** — the OAuth 2.0 username-password
grant — from plain CommonJS JavaScript with `require('client-sf-oauth')`.

**This flow is deprecated.** Salesforce is retiring the grant: it is disabled
by default on new orgs and on many orgs cannot be enabled at all. Prefer
`SF_JWTConnect` (no user present) or `SF_WebAppConnect` (user logs in through
the browser); see the root [README](../../README.md#which-flow). The example is
kept because the class still works where an org permits the grant.

## Environment variables

| Variable | Description |
|---|---|
| `clientId` | Connected App consumer key |
| `clientSecret` | Connected App consumer secret |
| `username` | Salesforce username |
| `password` | Salesforce password only |
| `usertoken` | Security token (empty if your login IP range is allowlisted) |
| `host` | Login host, e.g. `https://login.salesforce.com` — must be `https:` |

## Run

```bash
npm install
node index.js
```

The script prints the token response on success and only the error message on
failure — never the error object, which could carry the request body.

Full API reference: the root [README](../../README.md#api-reference).
