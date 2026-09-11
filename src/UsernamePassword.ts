import axios, { AxiosResponse } from "axios";
import { PassParameters } from "./interfaces/PassParameters";
import { optionalString, requireHttpsUrl, requireNonEmptyString } from "./validation";
import { redactTransportError } from "./errors";
import { joinUrl } from "./url";

/**
 * Salesforce OAuth 2.0 Username-Password flow.
 *
 * @deprecated Salesforce is retiring this grant. It is **disabled by default**
 * on new orgs, and on many orgs the "Allow OAuth Username-Password Flows"
 * setting no longer exists at all — so this flow cannot be enabled there by
 * any configuration.
 *
 * It is also the weakest of the three: it sends a user's password and security
 * token to the token endpoint on every call, it cannot support multi-factor
 * authentication, and it gives the client application a long-lived copy of a
 * human credential rather than a scoped token.
 *
 * Use instead:
 * - {@link JWT} (`SF_JWTConnect`) for server-to-server integrations — a
 *   certificate replaces the password entirely;
 * - {@link WebApp} (`SF_WebAppConnect`) when a human is present — the user
 *   authenticates with Salesforce directly and your application never sees
 *   their password.
 *
 * This class remains functional and supported for orgs that still permit the
 * grant, and it carries the same security fixes as the other two flows. It is
 * not scheduled for removal from this library; the deprecation reflects
 * Salesforce's own direction, not an intent to drop it.
 */
export default class UsernamePassword {

  private parameters: PassParameters;
  private service: string = 'services/oauth2/token';
  private grantType: string = 'password';

  constructor(parameters: PassParameters) {
    if (typeof parameters !== 'object' || parameters === null) {
      throw new TypeError('client-sf-oauth: parameters object is required.');
    }

    // Validate before anything else so a bad host can never reach the network.
    const host = requireHttpsUrl(parameters.host, 'host');
    const clientId = requireNonEmptyString(parameters.clientId, 'clientId');
    const clientSecret = requireNonEmptyString(parameters.clientSecret, 'clientSecret');
    const username = requireNonEmptyString(parameters.username, 'username');
    const password = requireNonEmptyString(parameters.password, 'password');
    // The security token is empty for orgs that allowlist the caller's IP range.
    const usertoken = optionalString(parameters.usertoken, 'usertoken');

    this.parameters = { host, clientId, clientSecret, username, password, usertoken };
  }

  public async requestAccessToken(): Promise<AxiosResponse> {

    // `URLSearchParams` performs correct `application/x-www-form-urlencoded`
    // escaping. The previous implementation concatenated `encodeURI()` output,
    // which leaves `&`, `=`, `+`, `?`, `#` and `/` unescaped — a credential
    // containing any of those injected extra parameters into the token request.
    const body = new URLSearchParams();
    body.append('grant_type', this.grantType);
    body.append('client_id', this.parameters.clientId);
    body.append('client_secret', this.parameters.clientSecret);
    body.append('username', this.parameters.username);
    // Concatenate BEFORE encoding, so the boundary between the two values is
    // escaped along with the values themselves.
    body.append('password', `${this.parameters.password}${this.parameters.usertoken}`);

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

    const endpoint = joinUrl(this.parameters.host, this.service);

    try {
      const axiosResponse: AxiosResponse = await axios.post(endpoint, body, { headers });
      return axiosResponse;
    } catch (cause) {
      // Never let the raw rejection out: it carries the form body on `config`.
      throw redactTransportError(cause, 'password grant token request');
    }
  }

}
