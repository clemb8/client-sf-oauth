/**
 * Constructor-boundary input validation.
 *
 * This library moves long-lived Salesforce credentials to an OAuth endpoint, so
 * every value that shapes the destination URL or the request body is checked
 * before any network or filesystem access happens.
 *
 * Validation messages name the offending field and NEVER echo its value — the
 * fields being validated are credentials, and an error message is an observable
 * channel like any other.
 */

const PREFIX = 'client-sf-oauth';

/**
 * Thrown when a constructor input is missing, empty, or malformed.
 * Carries the field name only; never the field value.
 */
export class InvalidParameterError extends Error {
  public readonly field: string;

  constructor(field: string, problem: string) {
    super(`${PREFIX}: parameter "${field}" ${problem}.`);
    this.name = 'InvalidParameterError';
    this.field = field;

    // Preserve the prototype chain across the ES5 downlevel target so that
    // `instanceof InvalidParameterError` holds for consumers.
    Object.setPrototypeOf(this, InvalidParameterError.prototype);
  }
}

/**
 * Assert that `value` is a present, non-empty string.
 *
 * @param value     the caller-supplied value
 * @param field     the parameter name, used verbatim in the error message
 * @returns         the validated string
 * @throws InvalidParameterError when absent, not a string, or blank
 */
export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new InvalidParameterError(field, 'is required and must be a string');
  }
  if (value.trim().length === 0) {
    throw new InvalidParameterError(field, 'is required and must not be empty');
  }
  return value;
}

/**
 * Assert that `value` is a syntactically valid absolute `https:` URL.
 *
 * A caller-supplied host is concatenated into the endpoint that receives the
 * credential, so an unvalidated host redirects that credential to an arbitrary
 * origin. Plain `http:` is rejected as well: it would put the credential on the
 * wire in cleartext.
 *
 * @param value     the caller-supplied host
 * @param field     the parameter name, used verbatim in the error message
 * @returns         the validated host, unchanged
 * @throws InvalidParameterError when not an absolute `https:` URL
 */
export function requireHttpsUrl(value: unknown, field: string): string {
  const candidate = requireNonEmptyString(value, field);

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new InvalidParameterError(
      field,
      'must be an absolute URL (for example "https://login.salesforce.com")',
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new InvalidParameterError(field, 'must use the "https:" scheme');
  }

  return candidate;
}

/**
 * Assert that `value` is a string when supplied, and normalise absence to `''`.
 *
 * Used for genuinely optional credential fragments such as the Salesforce
 * security token, which is empty for orgs that allowlist the caller's IP range.
 *
 * @throws InvalidParameterError when supplied but not a string
 */
export function optionalString(value: unknown, field: string): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new InvalidParameterError(field, 'must be a string when supplied');
  }
  return value;
}
