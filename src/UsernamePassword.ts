import axios, { AxiosResponse } from "axios";
import { PassParameters } from "./interfaces/PassParameters";

export default class UsernamePassword {

  private parameters: PassParameters;
  private service: string = 'services/oauth2/token';
  private grantType: string = 'password';

  constructor(parameters: PassParameters) {
    this.parameters = parameters;
  }

  public async requestAccessToken(): Promise<AxiosResponse> {

    const query = `?grant_type=${this.grantType}`
      + `client_id=${this.parameters.clientId}`
      + `&client_secret=${this.parameters.clientSecret}`
      + `&username=${this.parameters.username}`
      + `&password=${this.parameters.password}${this.parameters.usertoken}`;

    const endpoint = `${this.parameters.host}${this.service}${query}`;
    const headers = { 'Content-Type': 'application/json' }

    const axiosResponse: AxiosResponse = await axios.post(endpoint, { headers });
    return axiosResponse;
  }


}