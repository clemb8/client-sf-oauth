# client-sf-oauth

This is a sample client for the Salesforce Oauth Flows.

## Table of Contents

- [General Info](#general-information)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [Usage](#usage)
- [Project Status](#project-status)
- [Acknowledgements](#acknowledgements)

## General Information

This project aims to provide :
- An easy way to get credentials from Salesforce API ;

## Technologies Used

- Node JS - 17.0.1
- Typescript 4 

## Features

List the ready features here:

- Easily get Salesforce API credentials through :
  - Oauth JWT Flow;
  - Oauth Username/Password Flow ;
  - Oauth Web App integration Flow ;

## Usage

Check the Salesforce documentation [here](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_authenticate.htm&type=5).

Some Examples :

> **Never log a caught error object wholesale.** The library redacts what it
> throws — a thrown `Error` carries the HTTP status plus Salesforce's `error`
> and `error_description`, and never the request body, URL or headers — so log
> `error.message`, not the error object you happened to catch.

> `host` must be an absolute `https:` URL. A trailing slash is optional.

```typescript

import { SF_JWTConnect, JWTParameters } from 'client-sf-oauth';

async function JWTConnect() {

  const parameters: JWTParameters = {
    secret: process.env.privateKeyPath!,
    clientId: process.env.clientId!,
    username: process.env.username!
  };
  try {
    const connection = new SF_JWTConnect(parameters);
    const result = await connection.createJWTAndGetAccessToken(process.env.privateKeyPassphrase);
    console.log(result.data);
  } catch (ex: any) {
    console.error('JWT connect failed:', ex?.message ?? ex);
  }
}

JWTConnect();

```

```typescript

import { SF_PassConnect, PassParameters } from 'client-sf-oauth';

async function PassConnect() {

  const parameters: PassParameters = {
    clientId: process.env.clientId!,
    clientSecret: process.env.clientSecret!,
    username: process.env.username!,
    password: process.env.password!,
    usertoken: process.env.usertoken!,
    host: process.env.host!
  };
  try {
    const connection = new SF_PassConnect(parameters);
    const result = await connection.requestAccessToken();
    console.log(result.data);
  } catch (ex: any) {
    console.error('Password connect failed:', ex?.message ?? ex);
  }
}

PassConnect();

```

In plain javascript :

```javascript

const sf_oauth = require('client-sf-oauth');


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
        const connection = new sf_oauth.SF_PassConnect(parameters);
        const result = await connection.requestAccessToken();
        console.log(result.data);
    } catch (ex) {
        console.error('Password connect failed:', ex && ex.message ? ex.message : ex);
    }

}

getAccessToken();

```

## Errors

Every network call rejects with an `Error` that carries no credential material.
Useful properties:

| Property | Meaning |
|---|---|
| `message` | Human-readable summary, safe to log |
| `status` | HTTP status, when Salesforce responded |
| `error` | Salesforce's `error` field, e.g. `invalid_grant` |
| `errorDescription` | Salesforce's `error_description` field |
| `code` | Transport code when no response arrived, e.g. `ECONNREFUSED` |

Invalid constructor input throws before any network or filesystem access. The
message names the offending parameter and never echoes its value.

## Project Status

Project is: _Done_.
