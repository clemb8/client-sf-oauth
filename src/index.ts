import { JWTParameters } from './interfaces/JWTParameters';
import { PassParameters } from './interfaces/PassParameters';
import { WebAppParameters } from './interfaces/WebAppParameters';
import { WebAuthCodeParameters } from './interfaces/WebAuthCodeParameters';

export {
  JWTParameters,
  PassParameters,
  WebAppParameters,
  WebAuthCodeParameters
}

export { default as SF_JWTConnect } from './JWT';
export { default as SF_PassConnect } from './UsernamePassword';
export { default as SF_WebAppConnect } from './WebApp';