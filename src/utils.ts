/**
 * Build the extra-parameter portion of an authorize query string.
 *
 * Every key and every value is percent-encoded. The previous implementation
 * interpolated both raw, so any value containing `&` or `=` could append or
 * overwrite parameters in the authorize request.
 *
 * @param configInput  the flow parameters; credential-bearing keys are excluded
 * @param endpoint     the endpoint built so far, already carrying a query string
 * @returns            a new endpoint string; `endpoint` is not mutated
 */
export function includeParametersQuery<T extends object>(configInput: T, endpoint: string): string {
  const excludedKeys = [
    'clientId', 'clientSecret', 'host', 'redirectURI',
    // PKCE. `code_verifier` is the secret half of the exchange and must NEVER
    // appear in the authorize URL — putting it there would hand an interceptor
    // the very value PKCE exists to withhold. The challenge and its method are
    // excluded because the caller writes them into the query string directly;
    // forwarding them here as well would duplicate the parameter.
    'code_verifier', 'code_challenge', 'code_challenge_method',
  ];

  const pairs = Object.entries(configInput)
    .filter(([key, value]) =>
      !excludedKeys.includes(key) && value !== null && value !== undefined)
    .map(([key, value]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  // Only append a separator when there is something to append. The previous
  // implementation always appended one, and then decided each subsequent
  // separator from the total key count rather than the included key count, so a
  // trailing `&` was emitted whenever any key was excluded.
  if (pairs.length === 0) {
    return endpoint;
  }

  return `${endpoint}&${pairs.join('&')}`;
}
