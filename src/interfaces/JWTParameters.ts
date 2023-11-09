import { Parameters } from "./Parameters";

export interface JWTParameters extends Parameters {
  secret: string,
  secretText?: boolean,
  username: string,
  expiration?: number,
  environment?: string
}