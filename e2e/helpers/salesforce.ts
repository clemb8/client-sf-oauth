/**
 * Proof that an access token actually works.
 *
 * A token-shaped string in a 200 response is not proof of anything: the real
 * assertion is that Salesforce accepts the token on a subsequent call. This
 * uses the OAuth `userinfo` endpoint because it needs only the token itself
 * and is not tied to an API version.
 */

import axios from 'axios';

export interface UserInfo {
  user_id: string;
  organization_id: string;
  preferred_username: string;
}

/**
 * Call `/services/oauth2/userinfo` with the token.
 *
 * Uses a bare axios call rather than the library under test: this is the
 * independent check that the library's output is usable, so routing it back
 * through the library would make it circular.
 */
export async function fetchUserInfo(instanceUrl: string, accessToken: string): Promise<UserInfo> {
  const base = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl;
  const response = await axios.get(`${base}/services/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data as UserInfo;
}

/**
 * Revoke a token once a test is finished with it.
 *
 * These tests mint real credentials against a real org. Leaving them valid for
 * their full lifetime — potentially hours — is avoidable exposure for no
 * benefit, so every suite that obtains a token revokes it in teardown.
 *
 * Best-effort: a failed revoke must not fail the test that already passed.
 */
export async function revokeToken(instanceUrl: string, accessToken: string): Promise<void> {
  const base = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl;
  try {
    const body = new URLSearchParams();
    body.append('token', accessToken);
    await axios.post(`${base}/services/oauth2/revoke`, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch {
    // Intentionally swallowed. Revocation is hygiene, not an assertion, and a
    // revoke failure says nothing about the behaviour under test.
  }
}
