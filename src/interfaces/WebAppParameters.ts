import { Parameters } from "./Parameters";

export interface WebAppParameters extends Parameters {
  clientSecret: string,
  host: string,
  redirectURI: string,
}