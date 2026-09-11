import { randomBytes } from 'node:crypto';
import express from 'express';
import { SF_WebAppConnect, WebAuthCodeParameters } from 'client-sf-oauth';

const app = express();
const port = 3000;

const parameters: WebAuthCodeParameters = {
  clientId: process.env.clientId!,
  clientSecret: process.env.clientSecret!,
  redirectURI: process.env.redirectUri!,
  host: process.env.host!
}

/**
 * Pending authorizations, keyed by the `state` value sent to Salesforce.
 *
 * Two things have to survive the round trip, and both are per-user:
 *
 *  - the **PKCE code verifier**, because the authorize redirect and the
 *    callback are different HTTP requests. A single shared client instance
 *    would work for one user and then break as soon as two people authorize
 *    at once: the second request would overwrite the first one's verifier.
 *  - the **state** value, so the callback can prove it corresponds to an
 *    authorization this server actually started. Without that check the
 *    callback accepts a code from anywhere, which is the CSRF hole in the
 *    authorization-code flow.
 *
 * An in-memory Map keeps this example to one file. A real application uses
 * session middleware or a shared store — otherwise this breaks the moment you
 * run more than one process.
 */
interface PendingAuth {
  codeVerifier: string;
  expiresAt: number;
}
const pending = new Map<string, PendingAuth>();

/** Authorization codes are short-lived; the state that carries them should be too. */
const PENDING_TTL_MS = 10 * 60 * 1000;

function rememberAuthorization(state: string, codeVerifier: string): void {
  // Drop anything expired first, so an abandoned authorization cannot grow
  // this map without bound.
  const now = Date.now();
  for (const [key, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(key);
  }
  pending.set(state, { codeVerifier, expiresAt: now + PENDING_TTL_MS });
}

/** Consume a pending authorization. Single use: a replayed state is rejected. */
function consumeAuthorization(state: string): PendingAuth | undefined {
  const entry = pending.get(state);
  pending.delete(state);
  if (entry === undefined || entry.expiresAt <= Date.now()) return undefined;
  return entry;
}

app.get('/', (req, res) => {
  res.redirect('/oauth');
})

app.get('/oauth', async (req, res) => {
  // A fresh client per authorization: it generates this user's PKCE pair, and
  // `state` is a constructor parameter, so it has to be per-request too.
  const state = randomBytes(16).toString('base64url');
  const connect = new SF_WebAppConnect({ ...parameters, state });

  try {
    const response = await connect.requestAuthCode();

    // The verifier is a credential. It stays server-side and is never sent to
    // the browser, logged, or put in a URL.
    rememberAuthorization(state, connect.codeVerifier!);

    res.redirect(response);
  } catch (ex: any) {
    // The library redacts what it throws; log the message only, and never
    // return the error text to the browser.
    console.error('Authorization request failed:', ex?.message ?? ex);
    res.status(502).send('Authorization request failed.');
  }
});

app.get('/getAccessToken', async (req, res) => {
  const { code, state } = req.query;

  if (typeof code !== 'string' || code.length === 0) {
    res.status(400).send('Missing "code" query parameter.');
    return;
  }

  if (typeof state !== 'string' || state.length === 0) {
    res.status(400).send('Missing "state" query parameter.');
    return;
  }

  // CSRF check. An unknown, expired or already-used state means this callback
  // does not correspond to an authorization this server started, so the code
  // is not ours to redeem.
  const authorization = consumeAuthorization(state);
  if (authorization === undefined) {
    console.error('Rejected a callback with an unknown or expired state.');
    res.status(400).send('Unknown or expired authorization.');
    return;
  }

  try {
    const connect = new SF_WebAppConnect(parameters);
    const response = await connect.requestAccessTokenWithCode(code, authorization.codeVerifier);

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
