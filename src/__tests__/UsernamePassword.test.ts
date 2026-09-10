import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

import axios from 'axios';
import { SF_PassConnect } from '../index';
import { HOSTILE_VALUE, VALID_PASS_PARAMETERS } from './fixtures';

describe('SF_PassConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // FR5.1, FR5.2 — must fail against the pre-fix `encodeURI` concatenation.
  it('form-encodes credentials containing & = + ? # / without introducing parameters', async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: {} });

    await new SF_PassConnect({
      ...VALID_PASS_PARAMETERS,
      clientSecret: HOSTILE_VALUE,
      password: HOSTILE_VALUE,
      usertoken: HOSTILE_VALUE,
    }).requestAccessToken();

    const body = new URLSearchParams(String(vi.mocked(axios.post).mock.calls[0][1]));

    // No injected parameter: exactly the five the grant defines.
    expect([...body.keys()].sort()).toEqual([
      'client_id', 'client_secret', 'grant_type', 'password', 'username',
    ]);

    // Every value round-trips intact.
    expect(body.get('client_secret')).toBe(HOSTILE_VALUE);
    expect(body.get('username')).toBe(VALID_PASS_PARAMETERS.username);
    // password and usertoken are concatenated before encoding, so the boundary
    // between them is escaped along with the values.
    expect(body.get('password')).toBe(`${HOSTILE_VALUE}${HOSTILE_VALUE}`);
  });

  // FR9.3 — happy path
  it('posts the password grant to the token endpoint and returns the response', async () => {
    const response = { status: 200, data: { access_token: 'test-access-token' } };
    vi.mocked(axios.post).mockResolvedValue(response);

    const result = await new SF_PassConnect(VALID_PASS_PARAMETERS).requestAccessToken();

    expect(result).toBe(response);

    const [url, body, config] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe('https://login.salesforce.invalid/services/oauth2/token');
    expect(config?.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');

    const parsed = new URLSearchParams(String(body));
    expect(parsed.get('grant_type')).toBe('password');
    expect(parsed.get('client_id')).toBe(VALID_PASS_PARAMETERS.clientId);
    expect(parsed.get('client_secret')).toBe(VALID_PASS_PARAMETERS.clientSecret);
    expect(parsed.get('password')).toBe(
      `${VALID_PASS_PARAMETERS.password}${VALID_PASS_PARAMETERS.usertoken}`,
    );
  });
});
