import { Parameters } from "./Parameters";
import { WebAppParameters } from "./WebAppParameters";

export interface WebAuthCodeParameters extends Parameters, WebAppParameters {
  clientSecret: string,
  scope?: string,
  state?: string,
  immediate?: boolean,
  /**
   * PKCE challenge. Supply this only when you generate the verifier yourself;
   * you must then pass that verifier to `requestAccessTokenWithCode`. Leave it
   * unset and the library generates a pair for you.
   */
  code_challenge?: string,
  /** Defaults to `S256`. `plain` offers no protection and is not recommended. */
  code_challenge_method?: string,
  /**
   * PKCE verifier. Supply this to reuse a verifier you persisted between the
   * authorize redirect and the callback; the challenge is derived from it.
   * It is a secret and is never placed in a URL.
   */
  code_verifier?: string,
  display?: string,
  login_hint?: string,
  nonce?: string,
  prompt?: string
}