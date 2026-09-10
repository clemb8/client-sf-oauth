/**
 * URL assembly helpers.
 *
 * The library used to build endpoints by raw concatenation, which made a
 * trailing slash on `host` an undocumented part of the contract: supplying one
 * form worked and the other produced a malformed URL. Joining is explicit here
 * so both forms resolve to the same endpoint.
 */

/**
 * Join a base URL and a path segment with exactly one separating slash.
 *
 * Neither argument is mutated; a new string is returned.
 *
 * @param base  an absolute URL, with or without a trailing slash
 * @param path  a path segment, with or without a leading slash
 */
export function joinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
}
