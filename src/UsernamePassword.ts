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

    const body = `${encodeURI('grant_type')}=${encodeURI(this.grantType)}&` +
    `${encodeURI('client_id')}=${encodeURI(this.parameters.clientId)}&` +
    `${encodeURI('client_secret')}=${encodeURI(this.parameters.clientSecret)}&` +
    `${encodeURI('username')}=${encodeURI(this.parameters.username)}&` +
    `${encodeURI('password')}=${encodeURI(this.parameters.password) + encodeURI(this.parameters.usertoken)}`;

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

    const endpoint = `${this.parameters.host}${this.service}`;

    const axiosResponse: AxiosResponse = await axios.post(endpoint, body, { headers });
    return axiosResponse;
  }


}