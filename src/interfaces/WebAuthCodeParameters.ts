import { Parameters } from "./Parameters";
import { WebAppParameters } from "./WebAppParameters";

export interface WebAuthCodeParameters extends Parameters, WebAppParameters {
  scope?: string,
  state?: string,
  immediate?: boolean,
  code_challenge?: string,
  display?: string,
  login_hint?: string,
  nonce?: string,
  prompt?: string
}