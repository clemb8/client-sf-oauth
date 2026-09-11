/**
 * Shared assertions for the E2E suite.
 *
 * The redaction helper is the reason this suite is worth running at all. The
 * unit tests prove redaction against a *synthetic* axios rejection built by
 * `vi.mock`. These prove it against a real Salesforce 400 — a rejection whose
 * `config` genuinely carries the form body this library sent.
 */

import { inspect } from 'node:util';
import { expect } from 'vitest';
import { credentialValues } from './env';

/**
 * Every way an error could plausibly reach a log, a reporter, or stdout.
 *
 * A structured logger will not just read `.message`; it will serialize the
 * whole object, walk `cause`, and print the stack. Checking only the message
 * would pass while a secret sat one property away.
 */
export function serializeEveryWay(error: unknown): string {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
    parts.push(error.stack ?? '');
  }
  parts.push(String(error));
  parts.push(inspect(error, { depth: 10, showHidden: true, getters: true }));

  try {
    // A plain stringify drops non-enumerable fields, so include own properties
    // explicitly — this is what an error reporter typically ships.
    parts.push(JSON.stringify(error, Object.getOwnPropertyNames(Object(error))));
  } catch {
    // A circular structure cannot be stringified; the inspect() output above
    // already covers that shape.
  }

  return parts.join('\n');
}

/**
 * Assert that no credential from the environment survives into the error.
 *
 * On failure the message names the environment variable whose value leaked —
 * never the value itself, because that would put the secret into CI output.
 */
export function expectNoCredentialLeak(error: unknown): void {
  const serialized = serializeEveryWay(error);
  const leaked = credentialValues()
    .filter((entry) => serialized.includes(entry.value))
    .map((entry) => entry.name);

  expect(
    leaked,
    leaked.length > 0
      ? `credential material from ${leaked.join(', ')} survived into the thrown error`
      : undefined,
  ).toEqual([]);
}

/**
 * Assert the error is this library's redacted shape and carries something
 * actionable. A redacted error that says nothing is its own defect.
 */
export function expectRedactedOAuthError(error: unknown): Error & {
  status?: number;
  error?: string;
  errorDescription?: string;
  code?: string;
} {
  expect(error).toBeInstanceOf(Error);
  const typed = error as Error & { status?: number; error?: string; errorDescription?: string; code?: string };

  expectNoCredentialLeak(typed);

  // The raw axios rejection carries `config`, `request` and `response`. None
  // of them may survive: that is the whole point of the redaction.
  expect(typed, 'the raw axios rejection must not survive').not.toHaveProperty('config');
  expect(typed, 'the raw axios rejection must not survive').not.toHaveProperty('request');
  expect(typed, 'the raw axios rejection must not survive').not.toHaveProperty('response');
  expect(
    (typed as { cause?: unknown }).cause,
    '`cause` must not re-expose the original rejection',
  ).toBeUndefined();

  // Something the caller can act on: either Salesforce answered, or the
  // transport failed with a code.
  const actionable = typed.status !== undefined || typed.code !== undefined;
  expect(actionable, 'the error must carry a status or a transport code').toBe(true);

  return typed;
}

/** Assert a successful token response looks like one, without logging the token. */
export function expectTokenResponse(data: unknown): { access_token: string; instance_url: string } {
  expect(data, 'the token response must be an object').toBeTypeOf('object');
  const body = data as Record<string, unknown>;

  expect(typeof body.access_token, 'access_token must be a string').toBe('string');
  expect((body.access_token as string).length, 'access_token must be non-empty').toBeGreaterThan(0);
  expect(typeof body.instance_url, 'instance_url must be a string').toBe('string');
  expect(body.token_type, 'token_type must be Bearer').toBe('Bearer');

  return {
    access_token: body.access_token as string,
    instance_url: body.instance_url as string,
  };
}
