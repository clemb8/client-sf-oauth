import axios, { AxiosResponse } from "axios";
import { WebAuthCodeParameters } from "./interfaces/WebAuthCodeParameters";
import { includeParametersQuery } from "./utils";
import { requireHttpsUrl, requireNonEmptyString } from "./validation";
import { redactTransportError } from "./errors";
import { joinUrl } from "./url";

export default class WebApp {

  private parameters: WebAuthCodeParameters;

  constructor(parameters: WebAuthCodeParameters) {
    if (typeof parameters !== 'object' || parameters === null) {
      throw new TypeError('client-sf-oauth: parameters object is required.');
    }

    // Validate before anything else so a bad host can never reach the network.
    const host = requireHttpsUrl(parameters.host, 'host');
    const clientId = requireNonEmptyString(parameters.clientId, 'clientId');
    const clientSecret = requireNonEmptyString(parameters.clientSecret, 'clientSecret');
    const redirectURI = requireNonEmptyString(parameters.redirectURI, 'redirectURI');

    // Defensive copy: the caller keeps ownership of the object it passed in.
    this.parameters = { ...parameters, host, clientId, clientSecret, redirectURI };
  }

  public async requestAuthCode(): Promise<string> {
    const query = new URLSearchParams();
    query.append('client_id', this.parameters.clientId);
    query.append('redirect_uri', this.parameters.redirectURI);
    query.append('response_type', 'code');

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

  public async requestAccessTokenWithCode(code: string) {
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

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

    try {
      const axiosResponse: AxiosResponse = await axios.post(endpoint, body, { headers });
      return axiosResponse;
    } catch (cause) {
      throw redactTransportError(cause, 'authorization code token exchange');
    }
  }
}
