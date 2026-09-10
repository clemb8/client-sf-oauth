/**
 * Transport-error redaction.
 *
 * An `axios` rejection carries the full request configuration on `error.config`
 * — including the form body and the request URL, and therefore the client
 * secret, the user password, or the assertion. Letting that object reach the
 * caller means it reaches the caller's logger, its error reporter, and its
 * stdout.
 *
 * Every network call in this library therefore converts a rejection into an
 * `OAuthRequestError` built ONLY from fields that are safe to surface: the HTTP
 * status and the `error` / `error_description` pair Salesforce returns. The
 * original rejection is deliberately NOT attached as `cause`, because that would
 * put `config` back within reach of any structured logger.
 */

/**
 * A transport or protocol failure, stripped of credential material.
 *
 * Nothing on this error derives from the request body, the request URL, or the
 * request headers.
 */
export class OAuthRequestError extends Error {
  /** HTTP status code, when the request reached Salesforce and got a response. */
  public readonly status?: number;
  /** Salesforce's `error` field, e.g. `invalid_grant`. */
  public readonly error?: string;
  /** Salesforce's `error_description` field. */
  public readonly errorDescription?: string;
  /** Transport-level code for a request that never got a response, e.g. `ECONNREFUSED`. */
  public readonly code?: string;

  constructor(
    message: string,
    details: {
      status?: number;
      error?: string;
      errorDescription?: string;
      code?: string;
    } = {},
  ) {
    super(message);
    this.name = 'OAuthRequestError';
    this.status = details.status;
    this.error = details.error;
    this.errorDescription = details.errorDescription;
    this.code = details.code;

    // Preserve the prototype chain across the ES5 downlevel target so that
    // `instanceof OAuthRequestError` holds for consumers.
    Object.setPrototypeOf(this, OAuthRequestError.prototype);
  }
}

function readString(source: unknown, key: string): string | undefined {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(source: unknown, key: string): number | undefined {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : undefined;
}

function readObject(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }
  return (source as Record<string, unknown>)[key];
}

/**
 * Convert a transport rejection into a redacted `OAuthRequestError`.
 *
 * Only `response.status`, `response.data.error`, `response.data.error_description`
 * and the transport `code` are read. `config`, `request`, and the response
 * headers are never touched, so no credential can survive into the result.
 *
 * @param cause      the rejected value, of unknown shape
 * @param operation  a short, credential-free description of what was attempted
 */
export function redactTransportError(cause: unknown, operation: string): OAuthRequestError {
  const response = readObject(cause, 'response');
  const status = readNumber(response, 'status');
  const data = readObject(response, 'data');

  const error = readString(data, 'error');
  const errorDescription = readString(data, 'error_description');
  const code = readString(cause, 'code');

  if (status !== undefined) {
    const detail = [error, errorDescription].filter(Boolean).join(': ');
    const suffix = detail.length > 0 ? ` — ${detail}` : '';
    return new OAuthRequestError(
      `client-sf-oauth: ${operation} failed with HTTP ${status}${suffix}`,
      { status, error, errorDescription, code },
    );
  }

  // No response: the request never completed. Surface the transport code only —
  // the underlying message can embed the request target.
  const suffix = code !== undefined ? ` (${code})` : '';
  return new OAuthRequestError(
    `client-sf-oauth: ${operation} failed before a response was received${suffix}`,
    { code },
  );
}
