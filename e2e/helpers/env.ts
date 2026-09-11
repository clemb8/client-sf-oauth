/**
 * Environment access for the E2E suite.
 *
 * These tests talk to a real Salesforce org with real credentials. Two rules
 * shape everything here:
 *
 * 1. **Absent credentials skip, never fail.** A contributor without an org
 *    must be able to run the whole repository's tests without seeing red.
 * 2. **No credential value is ever returned to a log path.** `describeIf`
 *    reports which variables are MISSING by name; it never reports a value.
 */

/** Every variable the E2E suite can read, grouped by the flow that needs it. */
export const REQUIRED = {
  jwt: [
    'SF_JWT_CLIENT_ID',
    'SF_JWT_USERNAME',
    'SF_JWT_KEY_PATH',
  ],
  password: [
    'SF_PASS_CLIENT_ID',
    'SF_PASS_CLIENT_SECRET',
    'SF_PASS_USERNAME',
    'SF_PASS_PASSWORD',
    'SF_PASS_HOST',
  ],
  webapp: [
    'SF_WEB_CLIENT_ID',
    'SF_WEB_CLIENT_SECRET',
    'SF_WEB_HOST',
    'SF_WEB_REDIRECT_URI',
  ],
} as const;

export type FlowName = keyof typeof REQUIRED;

/** Read a variable, or throw. Only called inside a suite already gated by `hasEnv`. */
export function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`E2E: ${name} is not set. This suite should have been skipped.`);
  }
  return value;
}

/** Read an optional variable. */
export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? undefined : value;
}

/** Which of a flow's variables are absent. Names only — never values. */
export function missingFor(flow: FlowName): string[] {
  return REQUIRED[flow].filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === '';
  });
}

/** True when every variable the flow needs is present. */
export function hasEnv(flow: FlowName): boolean {
  return missingFor(flow).length === 0;
}

/**
 * A reason string for a skipped suite, naming the absent variables so the
 * reader knows exactly what to add to `.env`.
 */
export function skipReason(flow: FlowName): string {
  return `missing ${missingFor(flow).join(', ')} — see e2e/README.md`;
}

/**
 * Every credential value currently in the environment.
 *
 * The redaction assertions search serialized errors for these strings. Values
 * are only ever compared against, never printed: a failure message names the
 * variable, not its content.
 */
export function credentialValues(): Array<{ name: string; value: string }> {
  const names = [
    'SF_JWT_PASSPHRASE',
    'SF_PASS_CLIENT_SECRET',
    'SF_PASS_PASSWORD',
    'SF_PASS_USERTOKEN',
    'SF_WEB_CLIENT_SECRET',
  ];
  return names
    .map((name) => ({ name, value: process.env[name] ?? '' }))
    // A very short value would match by coincidence and make the assertion
    // meaningless, so only substantive secrets are searched for.
    .filter((entry) => entry.value.trim().length >= 8);
}
