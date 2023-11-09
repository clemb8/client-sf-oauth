import { SF_JWTConnect, JWTParameters } from 'client-sf-oauth';

async function JWTConnect() {

  const JWTParameters: JWTParameters = {
    secret: './key.pem',
    clientId: process.env.clientId!,
    username: process.env.username!
  };
  try {
    const connection = new SF_JWTConnect(JWTParameters);
    //console.log(connection);
    const result = await connection.createJWTAndGetAccessToken('test');
    console.log(result);
  } catch (ex: any) {
    console.log(ex);
  }
}

JWTConnect();