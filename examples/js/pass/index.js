const oauth = require('client-sf-oauth');


async function getAccessToken() {

    const PassParameters = {
        clientId: process.env.clientId,
        clientSecret: process.env.secret,
        username: process.env.username,
        password: process.env.password,
        usertoken: process.env.usertoken,
        host: process.env.host
    };

    try {
        const connection = new oauth.SF_PassConnect(PassParameters);
        //console.log(connection);
        const result = await connection.requestAccessToken();
        console.log(result);
    } catch (ex) {
        console.log(ex);

    }
    
}

getAccessToken();
