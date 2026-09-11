/**
 * PKCE (Proof Key for Code Exchange, RFC 7636).
 *
 * PKCE binds an authorization code to the client that requested it. The client
 * invents a secret (`code_verifier`), sends only its SHA-256 digest
 * (`code_challenge`) when asking for the code, and presents the secret itself
 * when redeeming it. An attacker who intercepts the code cannot redeem it
 * without the verifier.
 *
 * Salesforce requires this by default on Connected Apps created since
 * Winter '23, and rejects the authorize request outright with
 * `missing required code challenge` when it is absent.
 */

import { createHash, randomBytes } from 'node:crypto';

/** A verifier and the challenge derived from it. */
export interface PkcePair {
  /** The secret. Held by the client, sent only when redeeming the code. */
  codeVerifier: string;
  /** BASE64URL(SHA-256(codeVerifier)). Sent on the authorize request. */
  codeChallenge: string;
  /** Always `S256`. The `plain` method offers no protection and is not used. */
  codeChallengeMethod: 'S256';
}

/**
 * RFC 7636 §4.1 requires 43-128 characters from the unreserved set.
 *
 * 32 random bytes base64url-encoded yields exactly 43 characters and 256 bits
 * of entropy — the shortest permitted value that is also the strongest
 * available at that length.
 */
const VERIFIER_BYTES = 32;

/** Base64url: standard base64 with the URL-safe alphabet and no padding. */
function base64url(input: Buffer): string {
  return input.toString('base64url');
}

/**
 * Generate a fresh verifier/challenge pair.
 *
 * Uses `crypto.randomBytes`, which is cryptographically secure. `Math.random`
 * would be a defect here: a predictable verifier defeats the entire mechanism.
 */
export function createPkcePair(): PkcePair {
  const codeVerifier = base64url(randomBytes(VERIFIER_BYTES));
  return {
    codeVerifier,
    codeChallenge: deriveChallenge(codeVerifier),
    codeChallengeMethod: 'S256',
  };
}

/**
 * Derive the challenge for a verifier the caller already holds.
 *
 * Needed when a consumer supplies its own verifier — for example one it
 * persisted in a session between the authorize redirect and the callback.
 */
export function deriveChallenge(codeVerifier: string): string {
  return base64url(createHash('sha256').update(codeVerifier, 'ascii').digest());
}

/**
 * Validate a caller-supplied verifier against RFC 7636 §4.1.
 *
 * A verifier outside the permitted set is rejected by the authorization
 * server, so catching it here turns a confusing remote failure into a clear
 * local one. The value is never echoed: it is a secret.
 */
export function assertValidVerifier(codeVerifier: string): void {
  if (typeof codeVerifier !== 'string' || !/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) {
    throw new TypeError(
      'client-sf-oauth: codeVerifier must be 43-128 characters from the unreserved set ' +
        '[A-Za-z0-9-._~] (RFC 7636 §4.1).',
    );
  }
}
