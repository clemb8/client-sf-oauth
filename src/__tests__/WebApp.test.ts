import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

import axios from 'axios';
import { SF_WebAppConnect } from '../index';
import { HOSTILE_VALUE, VALID_WEBAPP_PARAMETERS } from './fixtures';

const RESPONSE_URL = 'https://app.example.invalid/callback?code=test-auth-code';

describe('SF_WebAppConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // FR6.2
  it('percent-encodes clientId, redirectURI and every extra authorize parameter', async () => {
    vi.mocked(axios.get).mockResolvedValue({ request: { res: { responseUrl: RESPONSE_URL } } });

    await new SF_WebAppConnect({
      ...VALID_WEBAPP_PARAMETERS,
      clientId: HOSTILE_VALUE,
      redirectURI: HOSTILE_VALUE,
      state: HOSTILE_VALUE,
      scope: 'api refresh_token',
    }).requestAuthCode();

    const url = new URL(String(vi.mocked(axios.get).mock.calls[0][0]));

    // Nothing injected: only the parameters the flow actually defines.
    // `code_challenge` / `code_challenge_method` are the PKCE pair the library
    // now generates for every authorize request.
    expect([...url.searchParams.keys()].sort())
      .toEqual([
        'client_id', 'code_challenge', 'code_challenge_method',
        'redirect_uri', 'response_type', 'scope', 'state',
      ]);

    expect(url.searchParams.get('client_id')).toBe(HOSTILE_VALUE);
    expect(url.searchParams.get('redirect_uri')).toBe(HOSTILE_VALUE);
    expect(url.searchParams.get('state')).toBe(HOSTILE_VALUE);
    expect(url.searchParams.get('scope')).toBe('api refresh_token');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  // FR9.3 — happy path
  it('requests the authorize endpoint and returns the redirect URL', async () => {
    vi.mocked(axios.get).mockResolvedValue({ request: { res: { responseUrl: RESPONSE_URL } } });

    const result = await new SF_WebAppConnect(VALID_WEBAPP_PARAMETERS).requestAuthCode();

    expect(result).toBe(RESPONSE_URL);

    const url = new URL(String(vi.mocked(axios.get).mock.calls[0][0]));
    expect(`${url.origin}${url.pathname}`)
      .toBe('https://login.salesforce.invalid/services/oauth2/authorize');
    // The authorize call must never carry the Connected App secret.
    expect(url.search).not.toContain(VALID_WEBAPP_PARAMETERS.clientSecret);
  });

  // FR6.1 — must fail against the pre-fix query-string POST.
  it('sends the token exchange in a form body, never in the query string', async () => {
    const response = { status: 200, data: { access_token: 'test-access-token' } };
    vi.mocked(axios.post).mockResolvedValue(response);

    await new SF_WebAppConnect(VALID_WEBAPP_PARAMETERS)
      .requestAccessTokenWithCode('test-auth-code');

    const [url, body, config] = vi.mocked(axios.post).mock.calls[0];

    // The URL carries none of the five parameters, and no secret.
    expect(url).toBe('https://login.salesforce.invalid/services/oauth2/token');
    for (const leaked of ['client_secret', 'code=', 'redirect_uri', 'grant_type', 'client_id']) {
      expect(String(url)).not.toContain(leaked);
    }
    expect(String(url)).not.toContain(VALID_WEBAPP_PARAMETERS.clientSecret);

    // The body carries all five.
    const parsed = new URLSearchParams(String(body));
    expect(parsed.get('grant_type')).toBe('authorization_code');
    expect(parsed.get('code')).toBe('test-auth-code');
    expect(parsed.get('client_id')).toBe(VALID_WEBAPP_PARAMETERS.clientId);
    expect(parsed.get('client_secret')).toBe(VALID_WEBAPP_PARAMETERS.clientSecret);
    expect(parsed.get('redirect_uri')).toBe(VALID_WEBAPP_PARAMETERS.redirectURI);

    expect(config?.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  // SEC-4 — PKCE. Salesforce requires this by default on Connected Apps
  // created since Winter '23; without it the authorize request is rejected
  // outright with "missing required code challenge".
  describe('PKCE', () => {
    it('sends an S256 challenge on authorize and the matching verifier on exchange', async () => {
      vi.mocked(axios.get).mockResolvedValue({ request: { res: { responseUrl: RESPONSE_URL } } });
      vi.mocked(axios.post).mockResolvedValue({ status: 200, data: {} });

      const client = new SF_WebAppConnect(VALID_WEBAPP_PARAMETERS);
      await client.requestAuthCode();

      const url = new URL(String(vi.mocked(axios.get).mock.calls[0][0]));
      const challenge = url.searchParams.get('code_challenge');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(challenge, 'a challenge must be present').toBeTruthy();

      const verifier = client.codeVerifier as string;
      expect(verifier, 'the verifier must be retrievable for the callback request').toBeTruthy();

      // The challenge must actually be the digest of the verifier: a pair that
      // does not verify is worse than no PKCE, because it looks protected.
      const expected = createHash('sha256').update(verifier, 'ascii').digest('base64url');
      expect(challenge).toBe(expected);

      await client.requestAccessTokenWithCode('test-auth-code');
      const body = new URLSearchParams(String(vi.mocked(axios.post).mock.calls[0][1]));
      expect(body.get('code_verifier')).toBe(verifier);
    });

    it('never puts the verifier in the authorize URL', async () => {
      vi.mocked(axios.get).mockResolvedValue({ request: { res: { responseUrl: RESPONSE_URL } } });

      const client = new SF_WebAppConnect(VALID_WEBAPP_PARAMETERS);
      await client.requestAuthCode();

      // The verifier is the secret half. Putting it in the authorize URL would
      // hand an interceptor the exact value PKCE exists to withhold.
      const requested = String(vi.mocked(axios.get).mock.calls[0][0]);
      expect(requested).not.toContain(client.codeVerifier as string);
      expect(requested).not.toContain('code_verifier');
    });

    it('generates a fresh pair per instance', async () => {
      vi.mocked(axios.get).mockResolvedValue({ request: { res: { responseUrl: RESPONSE_URL } } });

      const first = new SF_WebAppConnect(VALID_WEBAPP_PARAMETERS);
      const second = new SF_WebAppConnect(VALID_WEBAPP_PARAMETERS);
      await first.requestAuthCode();
      await second.requestAuthCode();

      expect(first.codeVerifier).not.toBe(second.codeVerifier);
    });

    it('accepts a caller-supplied verifier and derives its challenge', async () => {
      vi.mocked(axios.get).mockResolvedValue({ request: { res: { responseUrl: RESPONSE_URL } } });

      // 43 characters from the unreserved set — the RFC 7636 minimum.
      const supplied = 'a'.repeat(43);
      const client = new SF_WebAppConnect({ ...VALID_WEBAPP_PARAMETERS, code_verifier: supplied });
      await client.requestAuthCode();

      expect(client.codeVerifier).toBe(supplied);
      const url = new URL(String(vi.mocked(axios.get).mock.calls[0][0]));
      expect(url.searchParams.get('code_challenge'))
        .toBe(createHash('sha256').update(supplied, 'ascii').digest('base64url'));
    });

    it('lets an explicit exchange verifier win over the instance one', async () => {
      vi.mocked(axios.get).mockResolvedValue({ request: { res: { responseUrl: RESPONSE_URL } } });
      vi.mocked(axios.post).mockResolvedValue({ status: 200, data: {} });

      // The real web-application shape: the instance that built the authorize
      // URL is gone, and the callback passes the verifier it persisted.
      const client = new SF_WebAppConnect(VALID_WEBAPP_PARAMETERS);
      await client.requestAuthCode();

      const fromSession = 'b'.repeat(43);
      await client.requestAccessTokenWithCode('test-auth-code', fromSession);

      const body = new URLSearchParams(String(vi.mocked(axios.post).mock.calls[0][1]));
      expect(body.get('code_verifier')).toBe(fromSession);
    });

    it('rejects a verifier that violates RFC 7636 without echoing it', () => {
      const tooShort = 'short';
      expect(() => new SF_WebAppConnect({ ...VALID_WEBAPP_PARAMETERS, code_verifier: tooShort }))
        .toThrow(/codeVerifier/);

      try {
        // eslint-disable-next-line no-new
        new SF_WebAppConnect({ ...VALID_WEBAPP_PARAMETERS, code_verifier: 'not valid!' });
        expect.unreachable('an invalid verifier must throw');
      } catch (error) {
        // It is a secret; the message names the parameter, never its value.
        expect((error as Error).message).not.toContain('not valid!');
      }
    });
  });
});
