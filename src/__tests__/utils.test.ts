import { describe, expect, it } from 'vitest';
import { includeParametersQuery } from '../utils';

const BASE = 'https://login.salesforce.invalid/services/oauth2/authorize?response_type=code';

const CREDENTIAL_KEYS = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  host: 'https://login.salesforce.invalid',
  redirectURI: 'https://app.example.invalid/callback',
};

describe('includeParametersQuery', () => {
  // FR9.3 — happy path
  it('appends percent-encoded extra parameters and omits credential-bearing keys', () => {
    const result = includeParametersQuery(
      { ...CREDENTIAL_KEYS, scope: 'api refresh_token', state: 'a b&c=d' },
      BASE,
    );

    expect(result).toBe(`${BASE}&scope=api%20refresh_token&state=a%20b%26c%3Dd`);
    expect(result).not.toContain('test-client-secret');
  });

  // FR6.2 — trailing-separator correctness
  it('emits no trailing separator, and no separator at all when nothing is appended', () => {
    // Every key excluded: the endpoint must come back untouched.
    expect(includeParametersQuery(CREDENTIAL_KEYS, BASE)).toBe(BASE);

    // One included key among four excluded ones: exactly one separator, none trailing.
    const single = includeParametersQuery({ ...CREDENTIAL_KEYS, state: 'test-state' }, BASE);
    expect(single).toBe(`${BASE}&state=test-state`);
    expect(single.endsWith('&')).toBe(false);

    // null / undefined values are skipped without leaving a dangling separator.
    const withHoles = includeParametersQuery(
      { ...CREDENTIAL_KEYS, scope: 'api', state: undefined, nonce: null, prompt: 'login' },
      BASE,
    );
    expect(withHoles).toBe(`${BASE}&scope=api&prompt=login`);
    expect(withHoles).not.toContain('&&');
  });
});
