/**
 * JWT Bearer flow, against a real Salesforce org.
 *
 * Requires a Connected App with a certificate uploaded and the running user
 * pre-authorized. See e2e/README.md for the org-side setup.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { SF_JWTConnect } from '../src/index';
import { env, hasEnv, optionalEnv, skipReason } from './helpers/env';
import { expectNoCredentialLeak, expectRedactedOAuthError, expectTokenResponse } from './helpers/assertions';
import { fetchUserInfo, revokeToken } from './helpers/salesforce';

const run = hasEnv('jwt');

describe.skipIf(!run)(`JWT Bearer flow [${run ? 'live' : skipReason('jwt')}]`, () => {
  const minted: Array<{ instanceUrl: string; token: string }> = [];

  afterAll(async () => {
    // Never leave a live token behind that a test created.
    await Promise.all(minted.map(({ instanceUrl, token }) => revokeToken(instanceUrl, token)));
  });

  function connect(overrides: Partial<Parameters<typeof buildParams>[0]> = {}) {
    return new SF_JWTConnect(buildParams(overrides));
  }

  function buildParams(overrides: Record<string, unknown> = {}) {
    return {
      clientId: env('SF_JWT_CLIENT_ID'),
      username: env('SF_JWT_USERNAME'),
      secret: env('SF_JWT_KEY_PATH'),
      environment: optionalEnv('SF_JWT_ENVIRONMENT'),
      ...overrides,
    } as never;
  }

  const passphrase = optionalEnv('SF_JWT_PASSPHRASE');

  it('obtains an access token Salesforce actually accepts', async () => {
    const response = await connect().createJWTAndGetAccessToken(passphrase);

    expect(response.status).toBe(200);
    const { access_token, instance_url } = expectTokenResponse(response.data);
    minted.push({ instanceUrl: instance_url, token: access_token });

    // The real assertion: the token works. A token-shaped string proves nothing.
    const userInfo = await fetchUserInfo(instance_url, access_token);
    expect(userInfo.user_id, 'userinfo must identify a user').toBeTruthy();
    expect(userInfo.organization_id, 'userinfo must identify an org').toBeTruthy();
  });

  it('signs an assertion that carries the configured issuer and subject', () => {
    const jwt = connect().createJWT(passphrase);

    // Decode the payload without verifying — the signature is Salesforce's to
    // check, and it did so in the test above.
    const [, payload] = jwt.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    expect(claims.iss).toBe(env('SF_JWT_CLIENT_ID'));
    expect(claims.sub).toBe(env('SF_JWT_USERNAME'));
    expect(claims.aud).toMatch(/^https:\/\/(login|test)\.salesforce\.com$/);
    expect(claims.exp, 'the assertion must not already be expired').toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );
  });

  it('rejects an unknown user with a redacted error, not a raw axios rejection', async () => {
    const bogus = connect({ username: 'no-such-user@example.invalid' });

    await expect(bogus.createJWTAndGetAccessToken(passphrase)).rejects.toThrow();

    try {
      await bogus.createJWTAndGetAccessToken(passphrase);
      expect.unreachable('an unknown user must not yield a token');
    } catch (error) {
      const redacted = expectRedactedOAuthError(error);
      expect(redacted.status).toBe(400);
      // Salesforce's exact code depends on how far it got before giving up:
      // `invalid_grant` when it resolved the app but not the user,
      // `app_not_found` when the app could not be resolved in that user's
      // context. Both are correct rejections; pinning one makes the test
      // depend on org configuration rather than on library behaviour.
      expect(
        ['invalid_grant', 'app_not_found', 'invalid_client_id'],
        'an unauthorized user must be rejected with a recognisable OAuth error',
      ).toContain(redacted.error);
      expect(redacted.errorDescription, 'the description must survive redaction').toBeTruthy();
    }
  });

  it('never lets the signed assertion or key material reach the thrown error', async () => {
    const bogus = connect({ username: 'no-such-user@example.invalid' });

    try {
      await bogus.createJWTAndGetAccessToken(passphrase);
      expect.unreachable('an unknown user must not yield a token');
    } catch (error) {
      expectNoCredentialLeak(error);

      // The assertion is a bearer credential in its own right: anyone holding
      // it can request a token until it expires. It must not survive either.
      const serialized = `${(error as Error).message}${(error as Error).stack ?? ''}`;
      expect(serialized, 'the JWT assertion must not appear in the error').not.toMatch(
        /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
      );
      expect(serialized, 'PEM key material must not appear in the error').not.toContain('PRIVATE KEY');
    }
  });

  it('rejects a missing key file by naming the parameter, never echoing the path', () => {
    expect(() => connect({ secret: '/nonexistent/path/to/key.pem' })).toThrow(/secret/);

    try {
      connect({ secret: '/nonexistent/path/to/key.pem' });
      expect.unreachable('an unreadable key file must throw');
    } catch (error) {
      // The same parameter carries raw PEM text when `secretText` is set, so
      // the message must never echo its value.
      expect((error as Error).message).not.toContain('/nonexistent/path/to/key.pem');
    }
  });
});
