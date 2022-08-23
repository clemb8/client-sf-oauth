import { JWTParameters } from "./interfaces/JWTParameters";
import { sign } from "jsonwebtoken";
import axios, { AxiosResponse } from "axios";
import fs from 'fs';

export default class JWT {

  private iss: string;
  private sub: string;
  private aud: string;
  private exp: number;
  private key: string
  private service: string = 'services/oauth2/token';
  private grantType: string = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

  constructor(parameters: JWTParameters) {
    this.iss = parameters.clientId;
    this.sub = parameters.username;
    this.key = fs.readFileSync(parameters.secret, 'utf8');
    !parameters.expiration ? this.exp = Math.floor(Date.now() / 1000) + (60 * 60) : this.exp = parameters.expiration;
    parameters.environment === 'dev' ? this.aud = 'https://test.salesforce.com' : this.aud = 'https://login.salesforce.com';
  }

  public createJWT(passphrase?: string) : string {

    const claims = { iss: this.iss, sub: this.sub, aud: this.aud, exp: this.exp }
    const options = { header: { "alg":"RS256" } }
    let secret = null;
    passphrase ? secret = { key: this.key, passphrase } : secret = this.key;

    return sign(claims, secret, options);
  }

  public async requestAccessToken(jwt: string) : Promise<AxiosResponse> {

    const endpoint = `${this.aud}/${this.service}`;
    const params = new URLSearchParams();
    params.append('grant_type', this.grantType);
    params.append('assertion', jwt);
    const axiosResponse: AxiosResponse = await axios.post(endpoint, params);
    return axiosResponse;
  }

  public async createJWTAndGetAccessToken(passphrase?: string) : Promise<AxiosResponse> {
    const jwt = this.createJWT(passphrase);
    return await this.requestAccessToken(jwt);
  }

}