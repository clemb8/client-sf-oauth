/**
 * Web Server (authorization code) flow, against a real Salesforce org.
 *
 * **This flow cannot be fully automated.** Its middle step is a human logging
 * in to Salesforce in a browser and granting consent; there is no headless
 * substitute that does not amount to scripting a login form, which would be
 * both brittle and a credential-handling liability in its own right.
 *
 * So this suite tests the two halves that ARE machine-verifiable:
 *
 *  - the authorize URL this library builds is one Salesforce accepts;
 *  - the token exchange sends its parameters where it claims to, and fails
 *    safely on a bad code.
 *
 * The full round trip is available as an opt-in manual run: paste a real code
 * into `SF_WEB_AUTH_CODE` and the final test unskips. See e2e/README.md.
 */

import { describe, expect, it } from 'vitest';
import axios from 'axios';
import { SF_WebAppConnect } from '../src/index';
import { createPkcePair } from '../src/pkce';
import { env, hasEnv, optionalEnv, skipReason } from './helpers/env';
import { expectNoCredentialLeak, expectRedactedOAuthError, expectTokenResponse } from './helpers/assertions';
import { fetchUserInfo, revokeToken } from './helpers/salesforce';

const run = hasEnv('webapp');

describe.skipIf(!run)(`Web Server flow [${run ? 'live' : skipReason('webapp')}]`, () => {
  function connect(overrides: Record<string, unknown> = {}) {
    return new SF_WebAppConnect({
      clientId: env('SF_WEB_CLIENT_ID'),
      clientSecret: env('SF_WEB_CLIENT_SECRET'),
      host: env('SF_WEB_HOST'),
      redirectURI: env('SF_WEB_REDIRECT_URI'),
      ...overrides,
    } as never);
  }

  /**
   * Turn Salesforce's authorize-endpoint rejection into a diagnosis.
   *
   * The authorize endpoint answers with an HTML error page rather than JSON,
   * so the library's redacted error carries a bare `HTTP 400` and no
   * description. This probe replays the same shape of request the library
   * sends — including an `S256` PKCE challenge, which the library has sent on
   * every authorize request since 0.7.0 — and reads the page for a reason.
   */
  async function diagnoseAuthorizeFailure(): Promise<string> {
    const host = env('SF_WEB_HOST').replace(/\/$/, '');
    const pkce = createPkcePair();
    const url =
      `${host}/services/oauth2/authorize` +
      `?client_id=${encodeURIComponent(env('SF_WEB_CLIENT_ID'))}` +
      `&redirect_uri=${encodeURIComponent(env('SF_WEB_REDIRECT_URI'))}` +
      `&response_type=code` +
      `&code_challenge=${encodeURIComponent(pkce.codeChallenge)}` +
      `&code_challenge_method=${pkce.codeChallengeMethod}`;
    const probe = await axios.get(url, { maxRedirects: 0, validateStatus: () => true });
    const body = typeof probe.data === 'string' ? probe.data : '';

    if (/code[_%20]*challenge/i.test(body)) {
      return (
        'Salesforce rejected the PKCE challenge. This library sends an S256 code_challenge on ' +
        'every authorize request and the matching code_verifier on the token exchange, so a ' +
        'challenge complaint means the Connected App does not accept the S256 method or its ' +
        'OAuth settings have not finished propagating (allow a few minutes after saving).'
      );
    }
    if (/redirect_uri_mismatch/i.test(body)) {
      return 'the Connected App Callback URL does not match SF_WEB_REDIRECT_URI exactly.';
    }
    const hint = body.match(/error[^<]{0,160}/i);
    return hint ? hint[0].replace(/\s+/g, ' ') : `HTTP ${probe.status} with no error detail.`;
  }

  it('builds an authorize URL Salesforce accepts', async () => {
    const landed = await connect()
      .requestAuthCode()
      .catch(async (cause) => {
        throw new Error(`authorize request rejected — ${await diagnoseAuthorizeFailure()}`, { cause });
      });

    // Salesforce answers a valid authorize request by redirecting to its login
    // page. An invalid client id or redirect URI instead lands on an error
    // page carrying `error=` in the query string.
    expect(typeof landed, 'requestAuthCode must return the landing URL').toBe('string');
    expect(landed, 'a rejected authorize request lands on an OAuth error').not.toMatch(/[?&]error=/);
    expect(landed, 'a valid authorize request reaches a Salesforce page').toMatch(/salesforce\.com|force\.com/);
  });

  it('percent-encodes parameters it puts in the authorize URL', async () => {
    // `state` is forwarded verbatim into the query string. A value containing
    // form delimiters proves the encoding: unencoded, it would split into
    // extra query parameters and Salesforce would reject the request.
    const hostile = 'a&b=c d/e';
    const landed = await connect({ state: hostile })
      .requestAuthCode()
      .catch(async (cause) => {
        throw new Error(`authorize request rejected — ${await diagnoseAuthorizeFailure()}`, { cause });
      });

    expect(landed, 'the request must still be accepted').not.toMatch(/[?&]error=/);
    expect(landed, 'the raw unencoded value must never appear').not.toContain('a&b=c d/e');
  });

  it('sends the token exchange in a request body, never in the query string', async () => {
    // FR6.1, verified at the wire rather than through a mock. An axios
    // interceptor observes the request this library actually builds.
    let observedUrl = '';
    let observedBody: unknown;

    const interceptor = axios.interceptors.request.use((config) => {
      observedUrl = `${config.baseURL ?? ''}${config.url ?? ''}`;
      observedBody = config.data;
      return config;
    });

    try {
      await connect().requestAccessTokenWithCode('deliberately-invalid-code').catch(() => undefined);
    } finally {
      axios.interceptors.request.eject(interceptor);
    }

    expect(observedUrl, 'the client secret must never be in a URL').not.toContain(env('SF_WEB_CLIENT_SECRET'));
    expect(observedUrl, 'the authorization code must never be in a URL').not.toContain('deliberately-invalid-code');
    expect(observedUrl, 'no OAuth parameter belongs in the query string').not.toMatch(/[?&](client_secret|code|redirect_uri)=/);

    const body = String(observedBody ?? '');
    expect(body, 'the exchange parameters belong in the body').toContain('grant_type=authorization_code');
    expect(body).toContain('code=deliberately-invalid-code');
  });

  it('rejects an invalid authorization code with a redacted error', async () => {
    try {
      await connect().requestAccessTokenWithCode('deliberately-invalid-code');
      expect.unreachable('an invalid code must not yield a token');
    } catch (error) {
      const redacted = expectRedactedOAuthError(error);
      expect(redacted.status).toBe(400);
      // A well-formed-but-wrong code yields `invalid_grant`; a code Salesforce
      // cannot even parse yields `unknown_error`. Both are rejections, and
      // which one a given string produces is Salesforce's business, not this
      // library's. The assertion that matters is the redaction below.
      expect(
        ['invalid_grant', 'unknown_error', 'invalid_request'],
        'an invalid code must be rejected with a recognisable OAuth error',
      ).toContain(redacted.error);
      expectNoCredentialLeak(error);
    }
  });

  it('refuses a non-https host before any network call is made', () => {
    const insecure = env('SF_WEB_HOST').replace(/^https:/, 'http:');
    expect(() => connect({ host: insecure })).toThrow(/host/);
  });

  // ---------------------------------------------------------------------
  // Opt-in: the full round trip, with a code obtained by hand.
  // ---------------------------------------------------------------------

  const manualCode = optionalEnv('SF_WEB_AUTH_CODE');
  // The code was minted against a PKCE challenge, so it can only be redeemed
  // with the verifier that produced that challenge. See e2e/README.md for how
  // to obtain the pair.
  const manualVerifier = optionalEnv('SF_WEB_CODE_VERIFIER');

  it.skipIf(!manualCode)(
    'exchanges a real authorization code for a working token [manual: SF_WEB_AUTH_CODE]',
    async () => {
      const response = await connect().requestAccessTokenWithCode(manualCode as string, manualVerifier);

      expect(response.status).toBe(200);
      const { access_token, instance_url } = expectTokenResponse(response.data);

      try {
        const userInfo = await fetchUserInfo(instance_url, access_token);
        expect(userInfo.user_id).toBeTruthy();
      } finally {
        await revokeToken(instance_url, access_token);
      }
    },
  );
});
