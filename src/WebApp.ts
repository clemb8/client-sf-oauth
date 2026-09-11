import axios, { AxiosResponse } from "axios";
import { WebAuthCodeParameters } from "./interfaces/WebAuthCodeParameters";
import { includeParametersQuery } from "./utils";
import { requireHttpsUrl, requireNonEmptyString } from "./validation";
import { redactTransportError } from "./errors";
import { joinUrl } from "./url";
import { assertValidVerifier, createPkcePair, deriveChallenge } from "./pkce";

export default class WebApp {

  private parameters: WebAuthCodeParameters;

  /**
   * The PKCE verifier for the in-flight authorization, when this instance
   * generated one. Read it after `requestAuthCode()` and persist it alongside
   * the user's session: in a real web application the authorize redirect and
   * the callback are different HTTP requests, so the instance that built the
   * authorize URL is usually gone by the time the code comes back.
   */
  private verifier?: string;

  constructor(parameters: WebAuthCodeParameters) {
    if (typeof parameters !== 'object' || parameters === null) {
      throw new TypeError('client-sf-oauth: parameters object is required.');
    }

    // Validate before anything else so a bad host can never reach the network.
    const host = requireHttpsUrl(parameters.host, 'host');
    const clientId = requireNonEmptyString(parameters.clientId, 'clientId');
    const clientSecret = requireNonEmptyString(parameters.clientSecret, 'clientSecret');
    const redirectURI = requireNonEmptyString(parameters.redirectURI, 'redirectURI');

    // A caller-supplied challenge means the caller owns the verifier too, and
    // must pass it to requestAccessTokenWithCode. Validate the pair it implies.
    if (parameters.code_verifier !== undefined) {
      assertValidVerifier(parameters.code_verifier);
      this.verifier = parameters.code_verifier;
    }

    // Defensive copy: the caller keeps ownership of the object it passed in.
    this.parameters = { ...parameters, host, clientId, clientSecret, redirectURI };
  }

  /**
   * The PKCE code verifier bound to the most recent `requestAuthCode()` call,
   * or the one supplied at construction.
   *
   * `undefined` before the first authorize request. Treat the value as a
   * credential: store it in the user's server-side session, never in a cookie
   * readable by the browser and never in a log.
   */
  public get codeVerifier(): string | undefined {
    return this.verifier;
  }

  public async requestAuthCode(): Promise<string> {
    const query = new URLSearchParams();
    query.append('client_id', this.parameters.clientId);
    query.append('redirect_uri', this.parameters.redirectURI);
    query.append('response_type', 'code');

    // PKCE. Salesforce requires it by default on Connected Apps created since
    // Winter '23 and rejects the authorize request without it.
    //
    // Three cases, in precedence order:
    //  1. the caller supplied a verifier — derive its challenge;
    //  2. the caller supplied only a challenge — it owns the verifier and must
    //     pass it to the exchange; forward the challenge untouched;
    //  3. neither — generate a pair and keep the verifier for the exchange.
    if (this.parameters.code_verifier !== undefined) {
      this.verifier = this.parameters.code_verifier;
      query.append('code_challenge', deriveChallenge(this.verifier));
      query.append('code_challenge_method', 'S256');
    } else if (this.parameters.code_challenge !== undefined) {
      query.append('code_challenge', this.parameters.code_challenge);
      query.append('code_challenge_method', this.parameters.code_challenge_method ?? 'S256');
    } else {
      const pair = createPkcePair();
      this.verifier = pair.codeVerifier;
      query.append('code_challenge', pair.codeChallenge);
      query.append('code_challenge_method', pair.codeChallengeMethod);
    }

    const authorizeUrl = joinUrl(this.parameters.host, 'services/oauth2/authorize');
    // Extra parameters (scope, state, code_challenge, ...) are encoded by
    // `includeParametersQuery`. No credential-bearing key is ever included.
    const endpoint = includeParametersQuery(
      this.parameters,
      `${authorizeUrl}?${query.toString()}`,
    );

    try {
      const response = await axios.get(endpoint);
      return response.request.res.responseUrl;
    } catch (cause) {
      throw redactTransportError(cause, 'authorization code request');
    }
  }

  /**
   * Redeem an authorization code for an access token.
   *
   * @param code          the `code` query parameter Salesforce sent to the redirect URI
   * @param codeVerifier  the PKCE verifier for this authorization. Optional only
   *                      when the same instance issued the authorize request and
   *                      still holds it — which is true in a script, and false in
   *                      a web application, where the callback is a different
   *                      request. Read `codeVerifier` after `requestAuthCode()`,
   *                      persist it in the session, and pass it back here.
   */
  public async requestAccessTokenWithCode(code: string, codeVerifier?: string) {
    const endpoint = joinUrl(this.parameters.host, 'services/oauth2/token');

    // Every one of these parameters travels in the request BODY. The previous
    // implementation put them in the query string of a POST with an empty body,
    // which wrote the Connected App secret into every access log, proxy log and
    // referrer on the path.
    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('client_id', this.parameters.clientId);
    body.append('client_secret', this.parameters.clientSecret);
    body.append('redirect_uri', this.parameters.redirectURI);

    // The PKCE secret. Sent in the body with everything else — never in a URL.
    // An explicit argument wins over the instance's own verifier, because the
    // caller is the one that knows which authorization this code belongs to.
    const verifier = codeVerifier ?? this.verifier;
    if (verifier !== undefined) {
      assertValidVerifier(verifier);
      body.append('code_verifier', verifier);
    }

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

    try {
      const axiosResponse: AxiosResponse = await axios.post(endpoint, body, { headers });
      return axiosResponse;
    } catch (cause) {
      throw redactTransportError(cause, 'authorization code token exchange');
    }
  }
}
