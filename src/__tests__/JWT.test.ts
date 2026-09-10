import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock('jsonwebtoken', () => ({ sign: vi.fn(() => 'test.signed.jwt') }));
vi.mock('fs', () => ({ default: { readFileSync: vi.fn(() => '-----BEGIN FAKE TEST KEY-----') } }));

import axios from 'axios';
import fs from 'fs';
import { sign } from 'jsonwebtoken';
import { SF_JWTConnect } from '../index';

describe('SF_JWTConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.readFileSync).mockReturnValue('-----BEGIN FAKE TEST KEY-----');
    vi.mocked(sign).mockReturnValue('test.signed.jwt' as unknown as string);
  });

  // FR9.3 — happy path
  it('signs a JWT from the key file and exchanges it for an access token', async () => {
    const response = { status: 200, data: { access_token: 'test-access-token' } };
    vi.mocked(axios.post).mockResolvedValue(response);

    const connection = new SF_JWTConnect({
      clientId: 'test-client-id',
      username: 'test@example.invalid',
      secret: './test-key.pem',
    });

    const result = await connection.createJWTAndGetAccessToken('test-passphrase');

    expect(result).toBe(response);
    expect(fs.readFileSync).toHaveBeenCalledWith('./test-key.pem', 'utf8');

    const claims = vi.mocked(sign).mock.calls[0][0] as Record<string, unknown>;
    expect(claims.iss).toBe('test-client-id');
    expect(claims.sub).toBe('test@example.invalid');
    expect(claims.aud).toBe('https://login.salesforce.com');

    const [url, body] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe('https://login.salesforce.com/services/oauth2/token');

    const parsed = new URLSearchParams(String(body));
    expect(parsed.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(parsed.get('assertion')).toBe('test.signed.jwt');
  });
});
