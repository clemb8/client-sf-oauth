import express from 'express';
import path from 'path';
import { SF_WebAppConnect, WebAppParameters } from 'client-sf-oauth';

const app = express();
const port = 3000;

const parameters: WebAppParameters = {
  clientId: process.env.clientId,
  clientSecret: process.env.clientSecret,
  redirectURI: process.env.redirectUri,
  host: process.env.host
} 

const connect = new SF_WebAppConnect(parameters);

app.get('/', (req, res) => {
  res.redirect('/oauth');
})

app.get('/oauth', async (req, res) =>  {
  const response = await connect.requestAuthCode();
  res.redirect(response);
});

app.get('/getAccessToken', async (req, res) => {
  const { code } = req.query;
  const response = await connect.requestAccessTokenWithCode("" + code);
  console.log(response);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});