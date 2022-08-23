import axios, { AxiosResponse } from "axios";
import { WebAppParameters } from "./interfaces/WebAppParameters";
import { WebAuthCodeParameters } from "./interfaces/WebAuthCodeParameters";
import { includeParametersQuery } from "./utils";

export default class WebApp {

  private parameters: WebAppParameters;

  constructor(parameters: WebAuthCodeParameters) {
    this.parameters = parameters;
  }

  public async requestAuthCode(): Promise<string> {


    const query = `client_id=${this.parameters.clientId}&redirect_uri=${this.parameters.redirectURI}&response_type=code`;
    let endpoint = `${this.parameters.host}/services/oauth2/authorize?${query}`;
    endpoint = includeParametersQuery(this.parameters, endpoint);
    const response = await axios.get(endpoint);

    return response.request.res.responseUrl;
  }

  public async requestAccessTokenWithCode(code: string) {

    const query = `grant_type=authorization_code&code=${code}&client_id=${this.parameters.clientId}&client_secret=${this.parameters.clientSecret}&redirect_uri=${this.parameters.redirectURI}`
    const endpoint = `${this.parameters.host}/services/oauth2/token?${query}`;

    const axiosResponse: AxiosResponse = await axios.post(endpoint);
    return axiosResponse;
  }
}