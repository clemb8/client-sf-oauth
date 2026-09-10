import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

import axios from 'axios';
import { SF_PassConnect } from '../index';
import { VALID_PASS_PARAMETERS } from './fixtures';

describe('constructor input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // FR8.1
  it('rejects a host that is not an absolute https URL, before any network call', () => {
    const rejected = [
      'login.salesforce.invalid',              // not a URL
      '/services/oauth2/token',                // relative
      'http://login.salesforce.invalid',       // cleartext scheme
      '',                                      // empty
    ];

    for (const host of rejected) {
      expect(() => new SF_PassConnect({ ...VALID_PASS_PARAMETERS, host }))
        .toThrowError(/host/);
    }

    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  // FR8.2
  it('produces the same endpoint whether or not host carries a trailing slash', async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: {} });

    await new SF_PassConnect({ ...VALID_PASS_PARAMETERS, host: 'https://login.salesforce.invalid' })
      .requestAccessToken();
    await new SF_PassConnect({ ...VALID_PASS_PARAMETERS, host: 'https://login.salesforce.invalid/' })
      .requestAccessToken();

    const urls = vi.mocked(axios.post).mock.calls.map((call) => call[0]);
    expect(urls[0]).toBe('https://login.salesforce.invalid/services/oauth2/token');
    expect(urls[1]).toBe(urls[0]);
  });

  // FR8.3, FR8.4
  it('names the offending field and never echoes a credential value', () => {
    // Missing / blank required fields are named.
    for (const field of ['clientId', 'clientSecret', 'username', 'password'] as const) {
      expect(() => new SF_PassConnect({ ...VALID_PASS_PARAMETERS, [field]: '' }))
        .toThrowError(new RegExp(field));
      expect(() => new SF_PassConnect({ ...VALID_PASS_PARAMETERS, [field]: '   ' }))
        .toThrowError(new RegExp(field));
    }

    // A rejected value is never reflected back to the caller.
    const hostileHost = 'http://attacker.invalid/collect-credentials';
    let message = '';
    try {
      new SF_PassConnect({ ...VALID_PASS_PARAMETERS, host: hostileHost });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('host');
    expect(message).not.toContain('attacker.invalid');
    expect(message).not.toContain(hostileHost);

    expect(axios.post).not.toHaveBeenCalled();
  });
});
