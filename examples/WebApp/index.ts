import express from 'express';
import { SF_WebAppConnect, WebAppParameters } from 'client-sf-oauth';

const app = express();
const port = 3000;

const parameters: WebAppParameters = {
  clientId: process.env.clientId!,
  clientSecret: process.env.clientSecret!,
  redirectURI: process.env.redirectUri!,
  host: process.env.host!
}

// Throws immediately if any parameter is missing or `host` is not an https URL.
const connect = new SF_WebAppConnect(parameters);

app.get('/', (req, res) => {
  res.redirect('/oauth');
})

app.get('/oauth', async (req, res) => {
  try {
    const response = await connect.requestAuthCode();
    res.redirect(response);
  } catch (ex: any) {
    // The library redacts what it throws; log the message only, and never
    // return the error text to the browser.
    console.error('Authorization request failed:', ex?.message ?? ex);
    res.status(502).send('Authorization request failed.');
  }
});

app.get('/getAccessToken', async (req, res) => {
  const { code } = req.query;

  if (typeof code !== 'string' || code.length === 0) {
    res.status(400).send('Missing "code" query parameter.');
    return;
  }

  try {
    const response = await connect.requestAccessTokenWithCode(code);
    // Never log the whole response: it carries the access token.
    console.log('Access token acquired, expires:', response.data?.issued_at);
    res.send('Access token acquired.');
  } catch (ex: any) {
    console.error('Token exchange failed:', ex?.message ?? ex);
    res.status(502).send('Token exchange failed.');
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});
