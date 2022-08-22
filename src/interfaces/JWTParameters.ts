export interface JWTParameters {
  privateKey: string,
  clientId: string,
  username: string,
  expiration?: number,
  environment?: string
}