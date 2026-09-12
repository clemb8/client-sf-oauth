/**
 * Package metadata and documentation guards for the 0.7.1 discoverability
 * release. Every test reads a real repository file; nothing is mocked and no
 * network is used. Requirement IDs refer to the npm-metadata-audit
 * requirements document.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

/** The names `src/index.ts` exports — the whole public surface of 0.7.x. */
const ENTRY_POINT_EXPORTS = [
  'SF_JWTConnect',
  'SF_PassConnect',
  'SF_WebAppConnect',
  'JWTParameters',
  'PassParameters',
  'WebAppParameters',
  'WebAuthCodeParameters',
];

/** FR1.2 / NFR5: the mechanisms every description surface must name. */
const DESCRIPTION_TERMS = ['Salesforce', 'OAuth', 'JWT', 'PKCE', 'TypeScript'];

/** FR1.3: the minimum keyword set. */
const REQUIRED_KEYWORDS = [
  'salesforce', 'salesforce-api', 'oauth', 'oauth2', 'jwt', 'jwt-bearer', 'pkce',
  'authorization-code', 'connected-app', 'access-token', 'sfdc', 'typescript', 'nodejs',
];

const REPOSITORY_URL = 'https://github.com/clemb8/client-sf-oauth';

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

interface PackageManifest {
  name?: string;
  version?: string;
  description?: string;
  keywords?: string[];
  homepage?: string;
  bugs?: { url?: string };
  repository?: { type?: string; url?: string };
  license?: string;
  main?: string;
  types?: string;
  sideEffects?: boolean;
  engines?: { node?: string };
  exports?: unknown;
  module?: unknown;
  type?: unknown;
  files?: unknown;
}

function readManifest(): PackageManifest {
  return JSON.parse(read('package.json')) as PackageManifest;
}

/** GitHub's heading-anchor rule: lower-case, drop punctuation, spaces to hyphens. */
function anchorFor(heading: string): string {
  return heading.toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-');
}

/** Count `it(` cases the way the requirement specifies: `^\s*it(` per line. */
function countUnitTests(): number {
  const testsDir = path.join(ROOT, 'src/__tests__');
  return readdirSync(testsDir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => readFileSync(path.join(testsDir, name), 'utf8'))
    .reduce((total, source) => total + (source.match(/^\s*it\(/gm) ?? []).length, 0);
}

describe('package.json metadata (FR1)', () => {
  it('FR1.1–FR1.8: declares license, description, keywords, links, types, engines, sideEffects, repository', () => {
    const pkg = readManifest();

    expect(pkg.license).toBe('MIT');
    for (const term of DESCRIPTION_TERMS) {
      expect(pkg.description, `description must name ${term}`).toContain(term);
    }

    expect(pkg.keywords).toBeDefined();
    for (const keyword of REQUIRED_KEYWORDS) {
      expect(pkg.keywords, `keywords must include ${keyword}`).toContain(keyword);
    }
    for (const keyword of pkg.keywords ?? []) {
      expect(keyword, 'keywords must be lower-case').toBe(keyword.toLowerCase());
    }

    expect(pkg.homepage).toBe(`${REPOSITORY_URL}#readme`);
    expect(pkg.bugs?.url).toBe(`${REPOSITORY_URL}/issues`);
    expect(pkg.types).toBe('./dist/index.d.ts');
    expect(pkg.engines?.node).toBe('>=20');
    expect(pkg.sideEffects).toBe(false);
    expect(pkg.repository?.url).toBe(`git+${REPOSITORY_URL}.git`);
    expect(pkg.main).toBe('dist/index.js');
  });

  it('FR1.9: adds no exports, module, type, or files field', () => {
    const pkg = readManifest();
    for (const field of ['exports', 'module', 'type', 'files'] as const) {
      expect(pkg[field], `${field} must stay absent`).toBeUndefined();
    }
  });
});

describe('license file (FR2)', () => {
  it('FR2.1: License.txt carries the MIT text with the corrected copyright line', () => {
    const license = read('License.txt');

    expect(license.startsWith('MIT License')).toBe(true);
    expect(license.match(/Copyright \(c\) 2022-2026 clemb8/g)).toHaveLength(1);
    expect(license).not.toContain('Mohith');
    // The permission notice must be the unmodified MIT text.
    expect(license).toContain('Permission is hereby granted, free of charge, to any person obtaining a copy');
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
  });
});

describe('README (FR3)', () => {
  it('FR3.1 / FR3.9: opens without the stale wording, renders registry badges, and every ToC anchor resolves', () => {
    const readme = read('README.md');

    for (const stale of ['sample client', 'Project is: _Done_', '17.0.1', '#acknowledgements']) {
      expect(readme, `stale text "${stale}" must be gone`).not.toContain(stale);
    }

    const badges = readme.match(/img\.shields\.io\/[^)\s]*client-sf-oauth/g) ?? [];
    expect(badges.length).toBeGreaterThanOrEqual(3);

    const headings = new Set(
      readme.split('\n')
        .filter((line) => /^#{1,6} /.test(line))
        .map((line) => anchorFor(line.replace(/^#+ /, ''))),
    );
    const anchors = [...readme.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1]);
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(headings.has(anchor), `anchor #${anchor} must match a heading`).toBe(true);
    }
  });

  it('FR3.2 / FR3.4 / FR3.5 / FR3.6: documents install, both web-server methods, every export, the token fields, and the error prefix', () => {
    const readme = read('README.md');

    expect(readme.match(/npm install client-sf-oauth/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(readme).toContain('requestAuthCode');
    expect(readme).toContain('requestAccessTokenWithCode');
    for (const name of ENTRY_POINT_EXPORTS) {
      expect(readme, `API reference must list ${name}`).toContain(name);
    }
    for (const field of ['access_token', 'instance_url', 'token_type', 'issued_at']) {
      expect(readme).toContain(field);
    }
    expect(readme).toContain('`client-sf-oauth:`');
    expect(readme).toContain('not exported from the entry point');
  });

  it('FR3.7 / FR3.8: links to existing example directories and community files, and states the MIT license', () => {
    const readme = read('README.md');

    for (const example of ['examples/JWTandPass', 'examples/WebApp', 'examples/js/pass']) {
      expect(readme).toContain(`${REPOSITORY_URL}/tree/main/${example}`);
      expect(existsSync(path.join(ROOT, example)), `${example} must exist`).toBe(true);
    }
    for (const file of ['SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'License.txt']) {
      expect(readme).toContain(`${REPOSITORY_URL}/blob/main/${file}`);
      expect(existsSync(path.join(ROOT, file)), `${file} must exist`).toBe(true);
    }

    const licenseSection = readme.slice(readme.lastIndexOf('## License'));
    expect(licenseSection).toContain('MIT');
  });
});

describe('llms.txt (FR4)', () => {
  it('FR4.1: follows the llmstxt.org shape and names every export', () => {
    const lines = read('llms.txt').split('\n');
    const nonBlank = lines.filter((line) => line.trim().length > 0);

    expect(lines[0]).toBe('# client-sf-oauth');
    expect(nonBlank[1].startsWith('> ')).toBe(true);
    expect(nonBlank.filter((line) => line.startsWith('## ')).length).toBeGreaterThanOrEqual(4);
    for (const name of ENTRY_POINT_EXPORTS) {
      expect(nonBlank.join('\n'), `llms.txt must name ${name}`).toContain(name);
    }
  });

  it('FR4.3: contains no credential-shaped content or non-Salesforce hostnames', () => {
    const llms = read('llms.txt');

    expect(llms).not.toMatch(/secret=|password=|BEGIN (RSA )?PRIVATE KEY/i);
    const hosts = [...llms.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((match) => match[1]);
    const allowed = /(^|\.)salesforce\.com$|^raw\.githubusercontent\.com$|^github\.com$|^www\.npmjs\.com$/;
    for (const host of hosts) {
      expect(host, `unexpected hostname ${host}`).toMatch(allowed);
    }
  });
});

describe('AGENTS.md (FR5)', () => {
  it('FR5.1: covers the PKCE/state wiring, credential rules, deprecation, and the error-class limitation', () => {
    const agents = read('AGENTS.md');

    for (const marker of ['codeVerifier', 'state', 'https:', 'deprecated', 'response.data']) {
      expect(agents, `AGENTS.md must mention ${marker}`).toContain(marker);
    }
    expect(agents).toMatch(/single-use/);
    expect(agents).toMatch(/[Nn]ever log the caught error object/);
    expect(agents).toContain('not exported from the entry point');
    expect(agents).toMatch(/requestAccessTokenWithCode\(code, codeVerifier\)/);
  });
});

describe('examples (FR6)', () => {
  it('FR6.1–FR6.3: depend on 0.7.x, keep the PKCE/state handling, and each carries a README that points home', () => {
    for (const example of ['examples/JWTandPass', 'examples/WebApp', 'examples/js/pass']) {
      const manifest = JSON.parse(read(`${example}/package.json`)) as { dependencies?: Record<string, string> };
      expect(manifest.dependencies?.['client-sf-oauth'], `${example} dependency`).toMatch(/^\^0\.7\.\d+$/);

      const readme = read(`${example}/README.md`);
      expect(readme, `${example}/README.md must link the root README`).toContain('../../README.md');
      expect(readme).toMatch(/SF_(JWT|Pass|WebApp)Connect/);
    }

    const webApp = read('examples/WebApp/index.ts');
    expect(webApp).toContain('codeVerifier');
    expect(webApp).toContain('state');
    expect(read('examples/WebApp/index.html').trim().length).toBeGreaterThan(0);
    expect(read('examples/WebApp/index.html')).toContain('/oauth');
  });
});

describe('stale text (FR7)', () => {
  it('FR7.1: the e2e diagnostics and README no longer describe a PKCE-less flow', () => {
    const e2eTest = read('e2e/webapp.e2e.test.ts');
    const e2eReadme = read('e2e/README.md');

    expect(e2eTest).not.toContain('never sends a code_verifier');
    expect(e2eTest).not.toContain('without a verifier');
    expect(e2eTest).toContain('code_challenge_method');
    expect(e2eReadme).not.toMatch(/authorize\?client_id=<SF_WEB_CLIENT_ID>&redirect_uri=<SF_WEB_REDIRECT_URI>&response_type=code\s*$/m);
    expect(e2eReadme).toContain('SF_WEB_CODE_VERIFIER');
  });

  it('FR7.2: the CHANGELOG states the unit-test count that is true at release', () => {
    const changelog = read('CHANGELOG.md');
    const releaseEntry = changelog.slice(changelog.indexOf('### v0.7.1'), changelog.indexOf('### v0.7.0'));
    const stated = releaseEntry.match(/grows from 19 to (\d+) tests/);

    expect(stated, 'the v0.7.1 entry must state the new suite size').not.toBeNull();
    expect(Number(stated?.[1])).toBe(countUnitTests());
    // The historical 0.7.0 line was wrong (13); it had 19.
    expect(changelog).toContain('Vitest, 19 tests');
    expect(changelog).not.toContain('Vitest, 13 tests');
  });
});

describe('community files (FR8)', () => {
  it('FR8.1: SECURITY.md has a reporting section, supported versions, and the guarantees', () => {
    const security = read('SECURITY.md');

    expect(security).toMatch(/^## Reporting/m);
    expect(security).toContain('0.7.x');
    expect(security).toContain('security/advisories/new');
    expect(security).toMatch(/https:/);
    expect(security).toMatch(/[Rr]edacted/);
  });

  it('FR8.2: CONTRIBUTING.md names every script and the release rule', () => {
    const contributing = read('CONTRIBUTING.md');

    for (const script of ['npm ci', 'npm test', 'npm run lint', 'npm run typecheck:e2e', 'e2e/README.md', 'npm version', 'prepare']) {
      expect(contributing, `CONTRIBUTING.md must mention ${script}`).toContain(script);
    }
    expect(contributing).toMatch(/20 or newer|>=20/);
  });
});

describe('consistency across surfaces (NFR5)', () => {
  it('names the same mechanisms in package.json, the README opening, and the llms.txt summary', () => {
    const description = readManifest().description ?? '';
    const readmeOpening = read('README.md').split('\n').find((line) => line.startsWith('Get a Salesforce')) ?? '';
    const llmsSummary = read('llms.txt').split('\n').find((line) => line.startsWith('> ')) ?? '';

    for (const term of DESCRIPTION_TERMS) {
      expect(description, `package.json description must name ${term}`).toContain(term);
      expect(readmeOpening, `README opening must name ${term}`).toContain(term);
      expect(llmsSummary, `llms.txt summary must name ${term}`).toContain(term);
    }
  });
});

describe('native ESM import guidance (Build and Test loop-back 1, A4)', () => {
  const distIndex = path.join(ROOT, 'dist/index.js');
  const distExists = existsSync(distIndex);
  /** Spawning two Node processes is quick locally but leave room for slow CI. */
  const SPAWN_TIMEOUT_MS = 30_000;

  function runEsm(script: string) {
    return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: SPAWN_TIMEOUT_MS,
    });
  }

  // The documented shape must work; the shape the docs warn against must fail.
  // A future ESM build or `exports` map flips the second half, which is the
  // signal to rewrite the Install section — not to weaken this test.
  it('dist/index.js loads from native ESM via default import + destructure, and not via a named import [skipped until `npm run build` creates dist/]', { skip: !distExists, timeout: SPAWN_TIMEOUT_MS }, () => {
    const specifier = JSON.stringify(pathToFileURL(distIndex).href);

    const documented = runEsm(
      `import pkg from ${specifier}; const { SF_JWTConnect } = pkg; if (typeof SF_JWTConnect !== 'function') process.exit(1);`,
    );
    expect(documented.status, documented.stderr).toBe(0);

    const named = runEsm(`import { SF_JWTConnect } from ${specifier}; console.log(typeof SF_JWTConnect);`);
    expect(named.status, 'a named ESM import must fail in 0.7.x, as the README states').not.toBe(0);
    expect(named.stderr).toContain("Named export 'SF_JWTConnect' not found");
  });

  it('README and llms.txt document the default-import shape and no longer claim named-export detection', () => {
    for (const file of ['README.md', 'llms.txt']) {
      const text = read(file);
      expect(text, `${file} must not claim named-export detection`).not.toContain('detects the CommonJS named exports');
      expect(text, `${file} must show the native-ESM default import`).toContain("import pkg from 'client-sf-oauth'");
      expect(text, `${file} must say named ESM imports are unavailable`).toContain("Named export 'SF_JWTConnect' not found");
    }
  });
});
