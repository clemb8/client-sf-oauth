/**
 * Shared fixtures for the test suite.
 *
 * Excluded from the published build by `tsconfig.json`. No value in this file
 * is a real credential; every one is an obvious placeholder.
 */

/** Every character `encodeURI()` fails to escape. This string is the point of the encoding tests. */
export const HOSTILE_VALUE = 'a&b=c+d?e#f/g';

export const VALID_PASS_PARAMETERS = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  username: 'test@example.invalid',
  password: 'test-password',
  usertoken: 'test-usertoken',
  host: 'https://login.salesforce.invalid',
};

export const VALID_WEBAPP_PARAMETERS = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectURI: 'https://app.example.invalid/callback',
  host: 'https://login.salesforce.invalid',
};

export const VALID_JWT_PARAMETERS = {
  clientId: 'test-client-id',
  username: 'test@example.invalid',
  secret: '-----BEGIN FAKE TEST KEY-----',
  secretText: true,
};

/** A rejection shaped like a real axios failure, with credentials on `config`. */
export function axiosRejectionWithCredentials() {
  return {
    name: 'AxiosError',
    message: 'Request failed with status code 400',
    code: 'ERR_BAD_REQUEST',
    config: {
      url: `https://login.salesforce.invalid/services/oauth2/token?client_secret=${VALID_PASS_PARAMETERS.clientSecret}`,
      data: `grant_type=password&client_secret=${VALID_PASS_PARAMETERS.clientSecret}&password=${VALID_PASS_PARAMETERS.password}`,
      headers: { Authorization: 'Bearer test-bearer-token' },
    },
    request: { path: '/services/oauth2/token' },
    response: {
      status: 400,
      data: {
        error: 'invalid_grant',
        error_description: 'authentication failure',
      },
    },
  };
}

/** Every credential-ish string that must never survive into a thrown error. */
export const CREDENTIAL_NEEDLES = [
  VALID_PASS_PARAMETERS.clientSecret,
  VALID_PASS_PARAMETERS.password,
  'test-bearer-token',
];
