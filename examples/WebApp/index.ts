import express from 'express';
import path from 'path';
import { SF_WebAppConnect, WebAppParameters } from 'client-sf-oauth';

const app = express();
const port = 3000;

const parameters: WebAppParameters = {
  clientId: '3MVG9t0sl2P.pByq7.k8JmYX8F7yd157cBqUnNqsfYyfPsYX.t8S9vnjyD3IKeZL9B3.LuGdihY6VFR3vwXoM',
  clientSecret: '562EBD9D6A1093884D0CBA5619BC42A0BFC62D77C6B5F1B099803F2E750CED4E',
  redirectURI: 'http://localhost:3000/getAccessToken',
  host: 'https://wise-wolf-3lkdzp-dev-ed.my.salesforce.com/'
} 

const connect = new SF_WebAppConnect(parameters);

app.get('/', (req, res) => {
  res.redirect('/oauth');
  // res.sendFile(path.resolve(__dirname, "./", "index.html"), (err: any) => {
  //   if (err) {
  //     res.status(500).send({
  //       error: { status: 500, message: "Internal Server Error" },
  //     });
  //   }
  // });
})

app.get('/oauth', async (req, res) =>  {
  const response = await connect.requestAuthCode();
  console.log(response);
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