import { Parameters } from "./Parameters";

export interface JWTParameters extends Parameters {
  secret: string,
  username: string
  expiration?: number,
  environment?: string
}