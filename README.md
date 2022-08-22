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

## Usage

Check the Salesforce documentation [here](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_authenticate.htm&type=5).

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
    clientId: '3MVG9t0sl2P.pByq7.k8JmYX8F7yd157cBqUnNqsfYyfPsYX.t8S9vnjyD3IKeZL9B3.LuGdihY6VFR3vwXoM',
    secret: '562EBD9D6A1093884D0CBA5619BC42A0BFC62D77C6B5F1B099803F2E750CED4E',
    username: 'clem.boschet@wise-wolf-3lkdzp.com',
    password: 'password56',
    usertoken: 'TY1I5D6dAalbqEkfwrviMooba',
    host: 'https://wise-wolf-3lkdzp-dev-ed.my.salesforce.com/'
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

## Project Status

Project is: _in progress_.
