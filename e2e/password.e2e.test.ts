/**
 * Username-Password flow — DEPRECATED, and skipped by default.
 *
 * Salesforce disables this flow on new orgs and is retiring it; on many orgs
 * the "Allow OAuth Username-Password Flows" toggle no longer exists, so there
 * is no configuration that makes these tests pass. Leaving them red forever
 * would train everyone to ignore a red suite, which is worse than not running
 * them.
 *
 * The flow itself still works where an org permits it, and the library still
 * ships `SF_PassConnect`. Its security fixes are covered by the unit suite
 * (`src/__tests__/UsernamePassword.test.ts`), which needs no org at all: the
 * `encodeURI` form-injection regression and the error-redaction assertions
 * both run there on every `npm test`.
 *
 * To run these against an org that still permits the flow:
 *   SF_PASS_RUN_DEPRECATED=1 npm run test:e2e
 */

import { afterAll, describe, expect, it } from 'vitest';
import { SF_PassConnect } from '../src/index';
import { env, hasEnv, optionalEnv, skipReason } from './helpers/env';
import { expectNoCredentialLeak, expectRedactedOAuthError, expectTokenResponse } from './helpers/assertions';
import { fetchUserInfo, revokeToken } from './helpers/salesforce';

const optedIn = optionalEnv('SF_PASS_RUN_DEPRECATED') === '1';
const run = optedIn && hasEnv('password');

const suiteLabel = optedIn
  ? (hasEnv('password') ? 'live, deprecated flow' : skipReason('password'))
  : 'DEPRECATED — Salesforce is retiring this flow; set SF_PASS_RUN_DEPRECATED=1 to run';

describe.skipIf(!run)(`Username-Password flow [${suiteLabel}]`, () => {
  const minted: Array<{ instanceUrl: string; token: string }> = [];

  afterAll(async () => {
    await Promise.all(minted.map(({ instanceUrl, token }) => revokeToken(instanceUrl, token)));
  });

  function buildParams(overrides: Record<string, unknown> = {}) {
    return {
      clientId: env('SF_PASS_CLIENT_ID'),
      clientSecret: env('SF_PASS_CLIENT_SECRET'),
      username: env('SF_PASS_USERNAME'),
      password: env('SF_PASS_PASSWORD'),
      // A Developer Edition org with the login IP range relaxed needs no
      // security token, so this one is genuinely optional.
      usertoken: optionalEnv('SF_PASS_USERTOKEN') ?? '',
      host: env('SF_PASS_HOST'),
      ...overrides,
    } as never;
  }

  function connect(overrides: Record<string, unknown> = {}) {
    return new SF_PassConnect(buildParams(overrides));
  }

  it('obtains an access token Salesforce actually accepts', async () => {
    const response = await connect().requestAccessToken();

    expect(response.status).toBe(200);
    const { access_token, instance_url } = expectTokenResponse(response.data);
    minted.push({ instanceUrl: instance_url, token: access_token });

    const userInfo = await fetchUserInfo(instance_url, access_token);
    expect(userInfo.preferred_username, 'userinfo must name the authenticated user').toBeTruthy();
  });

  it('produces the same result whether or not host carries a trailing slash', async () => {
    const host = env('SF_PASS_HOST');
    const withSlash = host.endsWith('/') ? host : `${host}/`;
    const withoutSlash = host.endsWith('/') ? host.slice(0, -1) : host;

    const [a, b] = await Promise.all([
      connect({ host: withSlash }).requestAccessToken(),
      connect({ host: withoutSlash }).requestAccessToken(),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    for (const response of [a, b]) {
      const { access_token, instance_url } = expectTokenResponse(response.data);
      minted.push({ instanceUrl: instance_url, token: access_token });
    }
  });

  it('transmits a client secret containing form-delimiter characters intact', async () => {
    // This is the FR5.1 regression, validated by Salesforce's own parser.
    //
    // The old `encodeURI` implementation left & = + ? # / unescaped, so these
    // characters split into extra form parameters. Salesforce would then see a
    // malformed request rather than a wrong secret.
    //
    // The distinction is the whole assertion: `invalid_client` means the body
    // parsed correctly and the secret was simply wrong. Anything else — a
    // missing-parameter or malformed-request error — means the body was
    // corrupted in transit, which is the defect.
    const hostile = 'a&b=c+d?e#f/g';

    try {
      await connect({ clientSecret: hostile }).requestAccessToken();
      expect.unreachable('a bogus client secret must not yield a token');
    } catch (error) {
      const redacted = expectRedactedOAuthError(error);
      expect(redacted.status).toBe(400);
      expect(
        redacted.error,
        'a corrupted body would produce a different error than a merely wrong secret',
      ).toBe('invalid_client');
    }
  });

  it('rejects a wrong password with a redacted error carrying no credential', async () => {
    try {
      await connect({ password: 'definitely-not-the-password' }).requestAccessToken();
      expect.unreachable('a wrong password must not yield a token');
    } catch (error) {
      const redacted = expectRedactedOAuthError(error);
      expect(redacted.status).toBe(400);
      expect(redacted.error).toBe('invalid_grant');

      // The real axios rejection carried the form body, and the form body
      // carried every credential this flow sends.
      expectNoCredentialLeak(error);
      const serialized = `${redacted.message}${redacted.stack ?? ''}`;
      expect(serialized).not.toContain('definitely-not-the-password');
      expect(serialized, 'the username must not be echoed either').not.toContain(env('SF_PASS_USERNAME'));
    }
  });

  it('refuses a non-https host before any network call is made', () => {
    const insecure = env('SF_PASS_HOST').replace(/^https:/, 'http:');
    expect(() => connect({ host: insecure })).toThrow(/host/);
  });
});
