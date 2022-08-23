import { Parameters } from "./Parameters";

export interface JWTParameters extends Parameters {
  username: string
  expiration?: number,
  environment?: string
}