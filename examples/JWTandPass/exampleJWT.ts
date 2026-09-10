import { SF_JWTConnect, JWTParameters } from 'client-sf-oauth';

async function JWTConnect() {

  const JWTParameters: JWTParameters = {
    secret: process.env.privateKeyPath ?? './key.pem',
    clientId: process.env.clientId!,
    username: process.env.username!
  };
  try {
    const connection = new SF_JWTConnect(JWTParameters);
    const result = await connection.createJWTAndGetAccessToken(process.env.privateKeyPassphrase);
    console.log(result.data);
  } catch (ex: any) {
    // Never log the raw error: an axios rejection carries the request body and
    // therefore the signed assertion. The library already redacts what it
    // throws, so print only the message.
    console.error('JWT connect failed:', ex?.message ?? ex);
  }
}

JWTConnect();
