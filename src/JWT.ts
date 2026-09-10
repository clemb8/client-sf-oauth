import { JWTParameters } from "./interfaces/JWTParameters";
import { sign } from "jsonwebtoken";
import axios, { AxiosResponse } from "axios";
import fs from 'fs';
import { InvalidParameterError, requireNonEmptyString } from "./validation";
import { redactTransportError } from "./errors";
import { joinUrl } from "./url";

export default class JWT {

  private iss: string;
  private sub: string;
  private aud: string;
  private exp: number;
  private key: string
  private service: string = 'services/oauth2/token';
  private grantType: string = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

  constructor(parameters: JWTParameters) {
    if (typeof parameters !== 'object' || parameters === null) {
      throw new TypeError('client-sf-oauth: parameters object is required.');
    }

    // Validate before anything else, so the filesystem read below can never run
    // on an absent or empty path.
    this.iss = requireNonEmptyString(parameters.clientId, 'clientId');
    this.sub = requireNonEmptyString(parameters.username, 'username');
    const secret = requireNonEmptyString(parameters.secret, 'secret');

    this.key = parameters.secretText ? secret : JWT.readKeyFile(secret);

    this.exp = parameters.expiration
      ? parameters.expiration
      : Math.floor(Date.now() / 1000) + (60 * 60);
    // The audience is chosen from a fixed pair of Salesforce origins; it is
    // never caller-supplied, so there is no host to validate here.
    this.aud = parameters.environment === 'dev'
      ? 'https://test.salesforce.com'
      : 'https://login.salesforce.com';
  }

  /**
   * Read the PEM private key from disk.
   *
   * The error deliberately omits the path: when `secretText` is set the same
   * parameter carries key material, and a message that echoes it would put a
   * private key into the caller's log.
   */
  private static readKeyFile(path: string): string {
    try {
      return fs.readFileSync(path, 'utf8');
    } catch (cause) {
      const code = (cause as NodeJS.ErrnoException | undefined)?.code;
      const detail = code ? ` (${code})` : '';
      throw new InvalidParameterError(
        'secret',
        `could not be read as a private key file${detail}`,
      );
    }
  }

  public createJWT(passphrase?: string) : string {

    const claims = { iss: this.iss, sub: this.sub, aud: this.aud, exp: this.exp }
    const options = { header: { "alg":"RS256" } }
    const secret = passphrase ? { key: this.key, passphrase } : this.key;

    return sign(claims, secret, options);
  }

  public async requestAccessToken(jwt: string) : Promise<AxiosResponse> {

    const endpoint = joinUrl(this.aud, this.service);
    const params = new URLSearchParams();
    params.append('grant_type', this.grantType);
    params.append('assertion', jwt);

    try {
      const axiosResponse: AxiosResponse = await axios.post(endpoint, params);
      return axiosResponse;
    } catch (cause) {
      // The rejection carries the signed assertion on `config`; redact it.
      throw redactTransportError(cause, 'JWT bearer token request');
    }
  }

  public async createJWTAndGetAccessToken(passphrase?: string) : Promise<AxiosResponse> {
    const jwt = this.createJWT(passphrase);
    return await this.requestAccessToken(jwt);
  }

}
