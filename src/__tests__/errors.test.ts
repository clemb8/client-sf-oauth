import { inspect } from 'node:util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

import axios from 'axios';
import { SF_PassConnect } from '../index';
import {
  CREDENTIAL_NEEDLES,
  VALID_PASS_PARAMETERS,
  axiosRejectionWithCredentials,
} from './fixtures';

/** Render everything an observer could reach: message, stack, and every own property. */
function fullyRender(value: unknown): string {
  const error = value as Error;
  return [
    error?.message ?? '',
    error?.stack ?? '',
    inspect(value, { depth: null }),
    JSON.stringify(value) ?? '',
  ].join('\n');
}

async function captureThrown(): Promise<unknown> {
  const connection = new SF_PassConnect(VALID_PASS_PARAMETERS);
  return connection.requestAccessToken().then(
    () => {
      throw new Error('expected requestAccessToken to reject');
    },
    (error: unknown) => error,
  );
}

describe('transport error redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.post).mockRejectedValue(axiosRejectionWithCredentials());
  });

  // FR7.1, NFR1 — must fail against the pre-fix code, which has no try/catch.
  it('rethrows without any credential material from the request', async () => {
    const thrown = await captureThrown();
    const rendered = fullyRender(thrown);

    for (const needle of CREDENTIAL_NEEDLES) {
      expect(rendered).not.toContain(needle);
    }
    // The whole axios request envelope must be gone, not just the values.
    expect(rendered).not.toContain('Authorization');
    expect(rendered).not.toContain('grant_type=password');
    expect(thrown).not.toHaveProperty('config');
    expect(thrown).not.toHaveProperty('request');
  });

  // FR7.2 — the caller still gets what it needs to act.
  it('preserves the HTTP status and the Salesforce error description', async () => {
    const thrown = await captureThrown() as Error & {
      status?: number;
      error?: string;
      errorDescription?: string;
    };

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.status).toBe(400);
    expect(thrown.error).toBe('invalid_grant');
    expect(thrown.errorDescription).toBe('authentication failure');
    expect(thrown.message).toContain('400');
    expect(thrown.message).toContain('invalid_grant');
    expect(thrown.message).toContain('authentication failure');
  });
});
