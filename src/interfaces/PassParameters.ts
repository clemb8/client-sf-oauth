import { Parameters } from "./Parameters";

export interface PassParameters extends Parameters {
  password: string,
  usertoken: string,
  host: string
}