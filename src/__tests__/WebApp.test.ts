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
    expect([...url.searchParams.keys()].sort())
      .toEqual(['client_id', 'redirect_uri', 'response_type', 'scope', 'state']);

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
});
