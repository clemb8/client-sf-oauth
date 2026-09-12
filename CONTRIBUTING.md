# Contributing

Thanks for helping. This is a small library with one job — obtaining a
Salesforce access token — and a strong bias towards not exposing the
credentials it handles. Changes that keep that property are welcome.

## Prerequisites

- Node.js **20 or newer** and npm 10 (the package declares `engines.node >=20`).
- A Salesforce Developer Edition org only if you want to run the end-to-end
  suite; the unit suite needs no org, no network, and no credentials.

## Set up

```bash
git clone https://github.com/clemb8/client-sf-oauth.git
cd client-sf-oauth
npm ci
```

`npm ci` (and any `npm install`) runs the `prepare` script, which builds
`dist/` with `tsc`. That is expected: `dist/` is gitignored and rebuilt on
every install, pack, and publish.

## Everyday commands

| Command | What it does |
|---|---|
| `npm test` | Unit suite (Vitest). Offline, no credentials. Must stay green |
| `npm run lint` | ESLint over `src/` (flat config, typescript-eslint). Also runs as `prebuild` |
| `npx tsc --noEmit` | Type-check the library without emitting |
| `npm run typecheck:e2e` | Type-check the end-to-end suite (`e2e/tsconfig.json`) |
| `npm run build` | Compile `src/` to `dist/` (runs lint first) |
| `npm run test:e2e` | End-to-end suite against a real org — see below |

Before opening a pull request, all of `npm test`, `npm run lint`,
`npx tsc --noEmit`, and `npm run typecheck:e2e` should pass.

## Tests

- Unit tests live in `src/__tests__/` and are excluded from the build and the
  tarball. Every fix that touches credential handling should carry a test that
  fails against the previous behaviour.
- Documentation samples are tested too: `src/__tests__/docs-samples.test.ts`
  type-checks every fenced `ts` block in `README.md`, `llms.txt`, and
  `AGENTS.md` against `src/index.ts`, and
  `src/__tests__/package-metadata.test.ts` checks the package metadata and the
  documentation files. Keep samples complete (imports included) and free of
  real hostnames other than Salesforce's login hosts.
- The end-to-end suite talks to a real Salesforce org and needs the variables
  listed in `.env.example`. Setup for each flow, what each suite proves, and
  why the web server flow cannot be fully automated are all in
  [`e2e/README.md`](e2e/README.md). Suites whose variables are absent skip
  themselves by name; nothing fails because you have not configured a flow.

## Rules for credentials

- Never commit a key, a secret, or a `.env` file. `*.pem`, `*.key`, and
  `.env*` are ignored by git and by npm packing; treat that as a safety net,
  not a boundary.
- Never log a caught error object in library code, tests, examples, or docs.
  Log `error.message`.
- Any change to what a thrown error carries, what goes into a URL, or how
  input is validated is a security change: say so in the pull request.

## Releasing (maintainer)

1. Add the entry for the new version to `CHANGELOG.md` **before** bumping.
   The `version` npm script stages `CHANGELOG.md` into the release commit, and
   nothing regenerates the file.
2. `npm version patch` (or `minor` / `major`). The `postversion` script prints
   the push instructions.
3. `npm pack --dry-run` and confirm the file list is `dist/`, `README.md`,
   `CHANGELOG.md`, `License.txt`, `llms.txt`, `AGENTS.md`, `SECURITY.md`,
   `CONTRIBUTING.md`, and `package.json` — nothing from `src/`, `e2e/`,
   `examples/`, or any `.env*`, `*.pem`, `*.key` file.
4. `git push && git push --tags`, then `npm publish`.

Publishing is a deliberate, irreversible act: a published version cannot be
recalled, only deprecated.
