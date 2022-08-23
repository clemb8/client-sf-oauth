import axios, { AxiosResponse } from "axios";
import { WebAppParameters } from "./interfaces/AuthCodeParameters";

export default class WebApp {

  private parameters: WebAppParameters;

  constructor(parameters: WebAppParameters) {
    this.parameters = parameters;
  }

  public async requestAuthCode() {

    const query = `client_id=${this.parameters.clientId}&redirect_uri=${this.parameters.redirectURI}&response_type=code`;
    let endpoint = `${this.parameters.host}/services/oauth2/authorize?${query}`;

    return await axios.get(endpoint);
  }

  public async requestAccessTokenWithCode(code: string) {
    let endpoint = `${this.parameters.host}/services/oauth2/token`;

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('client_id', this.parameters.clientId);
    params.append('secret', this.parameters.secret);
    params.append('redirect_uri', this.parameters.redirectURI);

    const axiosResponse: AxiosResponse = await axios.post(endpoint, params);
    return axiosResponse;
  }
}