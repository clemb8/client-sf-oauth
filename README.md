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

```typescript

import { SF_JWTConnect, JWTParameters } from 'client-sf-oauth';

async function JWTConnect() {

  const JWTParameters: JWTParameters = {
    secret: './key.pem',
    clientId: process.env.clientId,
    username: process.env.username
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

```

```typescript

import { SF_PassConnect, PassParameters } from 'client-sf-oauth';

async function PassConnect() {

  const PassParameters: PassParameters = {
    clientId: process.env.clientId,
    secret: process.env.clientSecret,
    username: process.env.username,
    password: process.env.password,
    usertoken: process.env.usertoken,
    host: process.env.host
  };
  try {
    const connection = new SF_PassConnect(PassParameters);
    //console.log(connection);
    const result = await connection.requestAccessToken();
    console.log(result);
  } catch (ex: any) {
    le.log(ex);
  }
}

PassConnect();

```

In plain javascript :

```javascript

const sf_oauth = require('client-sf-oauth');


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
        const connection = new sf_oauth.SF_PassConnect(PassParameters);
        //console.log(connection);
        const result = await connection.requestAccessToken();
        console.log(result);
    } catch (ex) {
        console.log(ex);

    }
    
}

getAccessToken();

```

## Project Status

Project is: _Done_.
