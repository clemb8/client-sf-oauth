import { Parameters } from "./Parameters";

export interface WebAppParameters extends Parameters {
  host: string,
  redirectURI: string,
}