import { Parameters } from "./Parameters";

export interface PassParameters extends Parameters {
  username: string,
  password: string,
  usertoken: string,
  host: string
}