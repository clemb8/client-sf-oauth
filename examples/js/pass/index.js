const oauth = require('client-sf-oauth');


async function getAccessToken() {

    const parameters = {
        clientId: process.env.clientId,
        clientSecret: process.env.clientSecret,
        username: process.env.username,
        password: process.env.password,
        usertoken: process.env.usertoken,
        host: process.env.host
    };

    try {
        const connection = new oauth.SF_PassConnect(parameters);
        const result = await connection.requestAccessToken();
        console.log(result.data);
    } catch (ex) {
        // Never log the raw error: an axios rejection carries the form body and
        // therefore the password. The library already redacts what it throws,
        // so print only the message.
        console.error('Password connect failed:', ex && ex.message ? ex.message : ex);
    }

}

getAccessToken();
