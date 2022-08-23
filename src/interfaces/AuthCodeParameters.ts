import { Parameters } from "./Parameters";

export interface WebAppParameters extends Parameters {
  host: string,
  redirectURI: string,
  scope: string,
  state: string,
  immediate: boolean,
  code_challenge: string,
  display: string,
  login_hint: string,
  nonce: string,
  prompt: string
}