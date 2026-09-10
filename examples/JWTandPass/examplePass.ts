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
    const result = await connection.requestAccessToken();
    console.log(result.data);
  } catch (ex: any) {
    // Never log the raw error: an axios rejection carries the form body and
    // therefore the password. The library already redacts what it throws, so
    // print only the message.
    console.error('Password connect failed:', ex?.message ?? ex);
  }
}

PassConnect();