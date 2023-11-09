import { Parameters } from "./Parameters";

export interface PassParameters extends Parameters {
  clientSecret: string,
  username: string,
  password: string,
  usertoken: string,
  host: string
}