import { Parameters } from "./Parameters";

export interface JWTParameters extends Parameters {
  expiration?: number,
  environment?: string
}