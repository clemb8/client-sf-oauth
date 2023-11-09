import { SF_PassConnect, PassParameters } from 'client-sf-oauth';

async function PassConnect() {

  const PassParameters: PassParameters = {
    clientId: process.env.clientId!,
    clientSecret: process.env.secret!,
    username: process.env.username!,
    password: process.env.password!,
    usertoken: process.env.usertoken!,
    host: process.env.host!
  };
  try {
    const connection = new SF_PassConnect(PassParameters);
    //console.log(connection);
    const result = await connection.requestAccessToken();
    console.log(result);
  } catch (ex: any) {
    console.log(ex);
  }
}

PassConnect();