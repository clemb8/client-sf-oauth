# JWT and Username/Password examples

These two TypeScript scripts demonstrate **`SF_JWTConnect`** (the JWT bearer
flow, `exampleJWT.ts`) and the deprecated **`SF_PassConnect`** (the
username-password flow, `examplePass.ts`). Flow selection and the full API
reference are in the root [README](../../README.md#which-flow).

Neither example ships credentials, and **no key material is committed to this
repository** — `*.pem` is gitignored. Generate your own pair before running.

## Generate a key pair

```bash
openssl req -x509 -sha256 -nodes -days 365 \
  -newkey rsa:4096 -keyout key.pem -out cert.pem \
  -subj "/CN=client-sf-oauth-example"
```

Upload `cert.pem` to your Salesforce Connected App ("Use digital signatures").
Keep `key.pem` local.

To protect the key with a passphrase, drop `-nodes` and set
`privateKeyPassphrase` below to the passphrase you chose.

## Environment variables

| Variable | Used by | Description |
|---|---|---|
| `clientId` | both | Connected App consumer key |
| `username` | both | Salesforce username |
| `privateKeyPath` | `exampleJWT.ts` | Path to your private key (default `./key.pem`) |
| `privateKeyPassphrase` | `exampleJWT.ts` | Passphrase, only if the key is encrypted |
| `secret` | `examplePass.ts` | Connected App consumer secret |
| `password` | `examplePass.ts` | Salesforce password |
| `usertoken` | `examplePass.ts` | Salesforce security token (empty if your IP is allowlisted) |
| `host` | `examplePass.ts` | Login host, e.g. `https://login.salesforce.com` — must be `https:` |

## Run

```bash
npm install
npx tsc
node dist/exampleJWT.js     # or dist/examplePass.js
```
