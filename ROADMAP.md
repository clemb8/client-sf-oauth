# Roadmap

Goal: cover every OAuth 2.0 / OpenID Connect flow and option that Salesforce
exposes as an **authorization server** (Connected Apps and External Client
Apps), while keeping the library small, typed and credential-safe.

Baseline: **v0.7.1** ships three flows — JWT bearer, web-server
(authorization code) with PKCE, and username-password (deprecated). Every
method returns a raw `AxiosResponse`; there is no token lifecycle, no
identity endpoint, and no typed token response.

Dates below come from Salesforce's published retirement schedule and shape
the ordering:

| Date | Salesforce change | Effect on this library |
|------|-------------------|------------------------|
| Spring '26 | Creating new Connected Apps is restricted; External Client Apps (ECA) are the replacement | Docs and examples must speak ECA first, Connected App second |
| 30 Nov 2026 | Device flow restricted to *local* ECAs with a `localhost` callback | Device flow is still worth shipping (CLI / local tools) but must document the constraint |
| 20 Feb 2027 | Username-password and user-agent flows retired | `SF_PassConnect` removal in 1.0; user-agent flow is **not** on the roadmap |
| Summer '27 | Remaining Connected Apps must migrate to ECA | Nothing code-side; docs only |

## 1. Coverage matrix

Legend: ✅ shipped · 🟡 partial · ❌ missing · ⛔ deliberately skipped

### Flows

| # | Salesforce flow | Grant / response type | Status | Target |
|---|-----------------|-----------------------|--------|--------|
| 1 | Web server (authorization code) + PKCE | `response_type=code`, `grant_type=authorization_code` | ✅ | — |
| 2 | JWT bearer | `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` | 🟡 `aud` limited to login/test; no My Domain or Experience Cloud audience | 0.8 |
| 3 | Username-password | `grant_type=password` | ✅ deprecated | removed in 1.0 |
| 4 | **Refresh token** | `grant_type=refresh_token` | ❌ | **0.8** |
| 5 | **Client credentials** | `grant_type=client_credentials` | ❌ | **0.8** |
| 6 | Device (IoT / CLI) | `response_type=device_code` then `grant_type=device` | ❌ | 0.9 |
| 7 | Authorization code and credentials (headless login) | `response_type=code_credentials` | ❌ | 0.9 |
| 8 | OpenID Connect on top of web server flow (`id_token`) | `scope=openid`, `nonce` | 🟡 `nonce` param accepted, `id_token` never verified | 0.9 |
| 9 | SAML bearer assertion | `grant_type=urn:ietf:params:oauth:grant-type:saml2-bearer` | ❌ | 0.10 |
| 10 | SAML assertion | `grant_type=assertion`, `assertion_type=urn:oasis:names:tc:SAML:2.0:profiles:SSO:browser` | ❌ | 0.10 |
| 11 | Token exchange (RFC 8693, ECA only) | `grant_type=urn:ietf:params:oauth:grant-type:token-exchange` | ❌ | 0.10 |
| 12 | Asset token (IoT) | `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` + `actor_token` | ❌ | 0.10 |
| 13 | User-agent (implicit) | `response_type=token` | ⛔ retired 20 Feb 2027, tokens in URL | never |
| 14 | Hybrid web server / hybrid app token | `response_type=code` + `grant_type=hybrid_refresh` | ⛔ Salesforce-mobile-only, needs Lightning session bridge | never unless requested |
| 15 | Headless Identity (registration, passwordless, forgot password) | Experience Cloud REST, not token endpoint | ⛔ out of scope: not OAuth | never |

### Endpoints and options

| Item | Endpoint / parameter | Status | Target |
|------|----------------------|--------|--------|
| Typed token response | `access_token`, `refresh_token`, `instance_url`, `id`, `token_type`, `issued_at`, `signature`, `scope`, `id_token`, `sfdc_community_url`, `sfdc_community_id` | ❌ raw `AxiosResponse` | **0.8** |
| Response signature check | HMAC-SHA256 of `id + issued_at` with client secret | ❌ | 0.8 |
| Token revocation | `POST /services/oauth2/revoke` | ❌ | 0.8 |
| Token introspection | `POST /services/oauth2/introspect` | ❌ | 0.8 |
| UserInfo | `GET /services/oauth2/userinfo` | ❌ | 0.9 |
| Identity URL | `GET <id>` (`/id/<orgId>/<userId>`) | ❌ | 0.9 |
| OIDC discovery + JWKS | `/.well-known/openid-configuration`, `/id/keys` | ❌ | 0.9 |
| Client authentication methods | `client_secret_post` only | 🟡 no `client_secret_basic`; secret mandatory even with PKCE | 0.8 |
| Authorize URL builder without a network call | `requestAuthCode()` performs an HTTP GET and returns the redirect target | 🟡 | 0.8 |
| Custom token-endpoint host for JWT | `aud` + POST host tied to `environment` | 🟡 | 0.8 |
| Experience Cloud / community endpoints | `https://<site>/services/oauth2/...` | 🟡 works via `host`; untested, undocumented | 0.9 |
| `format` / `Accept` on token endpoint | `format=json\|urlencoded\|xml` | ⛔ JSON only | never |
| Token lifecycle helper | cache + auto-refresh + `instance_url` | ❌ | 0.10 |
| Typed OAuth error codes | `invalid_grant`, `invalid_client`, `invalid_request`, `unsupported_grant_type`, `access_denied`, `authorization_pending`, `slow_down`, ... | 🟡 generic `TransportError` | 0.8 |

## 2. Phases

### 0.8 — Foundation + the two flows everybody needs

Why first: refresh token and client credentials are the flows Salesforce
itself recommends as replacements for username-password and remote device
flow. They are also the smallest to implement once the foundation exists.

1. **`TokenResponse` type** and a `parseTokenResponse(response)` helper
   (validate shape, never log the body). Every existing method keeps
   returning `AxiosResponse` in 0.x; the helper is additive. Removing the
   raw return is a 1.0 breaking change.
2. **Typed OAuth errors**: `OAuthError extends TransportError` carrying
   `error` and `error_description` from the JSON body; redaction unchanged.
3. **Client authentication** option on every confidential-client flow:
   `clientAuth: 'post' | 'basic'`; `clientSecret` becomes optional on
   `SF_WebAppConnect` when PKCE is active (ECA "require secret for web
   server flow" off).
4. **`SF_RefreshTokenConnect`** (or `refresh(refreshToken)` on the web-server
   class): `grant_type=refresh_token`, `client_id`, optional
   `client_secret`, optional `format`. Document that `expires_in` is absent
   and that introspection is the way to learn token lifetime.
5. **`SF_ClientCredentialsConnect`**: `grant_type=client_credentials`;
   secret in body or `Authorization: Basic`; validate `host` HTTPS; document
   the "run as" integration user requirement.
6. **Revoke** and **introspect** helpers (both authenticated with the client
   secret, both POST, form-encoded, redacted on failure).
7. **JWT audience / endpoint** override: `loginUrl?: string` validated with
   `requireHttpsUrl`; `environment` stays as the shorthand. Enables My Domain
   and Experience Cloud audiences.
8. **`buildAuthorizeUrl()`** on `SF_WebAppConnect`: pure function, no
   network. `requestAuthCode()` stays for scripts and is documented as such.
9. **Signature verification** of the token response (`signature` field)
   as an opt-in helper.

Deliverables per flow: class + parameter interface + unit tests (happy path
and two error cases minimum) + e2e test behind the existing `SF_*` env gate
+ README quick start + `examples/` entry + CHANGELOG entry + `llms.txt`.

### 0.9 — Interactive and identity

1. **Device flow**: `requestDeviceCode()` (`response_type=device_code`,
   returns `device_code`, `user_code`, `verification_uri`, `interval`) and
   `pollForToken()` honouring `authorization_pending` / `slow_down` with a
   caller-supplied abort signal. README must state the 30 Nov 2026
   localhost-ECA restriction up front.
2. **Authorization code and credentials flow** (headless login):
   `response_type=code_credentials` with username/password in the body,
   then the standard code exchange. Private-client variant first;
   public-client variant if a Salesforce org confirms the parameters.
3. **OIDC**: verify `id_token` (RS256 via `/id/keys` JWKS, `iss`, `aud`,
   `nonce`, `exp`), expose `decodeIdToken()`; add `scope=openid` guidance.
4. **UserInfo**, **Identity URL** and **discovery** clients, all GET with
   bearer auth, typed responses.
5. **Experience Cloud**: e2e coverage against a community host; document
   `sfdc_community_url` / `sfdc_community_id`.

### 0.10 — Federation and ergonomics

1. **SAML bearer assertion** flow (caller supplies the base64 assertion; the
   library never signs SAML).
2. **SAML assertion** flow (`grant_type=assertion`).
3. **Token exchange** (ECA + `Auth.Oauth2TokenExchangeHandler` on the org
   side): `subject_token`, `subject_token_type`, `requested_token_type`,
   optional `actor_token`.
4. **Asset token** flow: JWT bearer with `actor_token`; reuse `SF_JWTConnect`
   signing.
5. **`TokenManager`**: holds a `TokenResponse`, refreshes on demand or on a
   401 callback, exposes `instance_url`; no global state, no timers by
   default.

### 1.0 — Breaking cleanup

- Remove `SF_PassConnect` (Salesforce retires the grant on 20 Feb 2027).
- All methods return `TokenResponse`; `AxiosResponse` access via an
  explicit `raw` option only.
- Consider dropping `axios` for native `fetch` (Node ≥ 20 already required).
- Rename classes to drop the `SF_` prefix under a namespace export; keep
  aliases for one minor.

## 3. Cross-cutting rules for every item

- **Secrets in bodies, never in URLs or errors.** Same `redactTransportError`
  path for every new request.
- **Validate at the boundary**: `requireHttpsUrl` for every host,
  `requireNonEmptyString` for every credential, schema check on every
  token-endpoint JSON body.
- **Immutable parameters**: defensive copy in every constructor, no mutation
  after construction.
- **One flow, one file**, ≤ 200 lines; shared transport in `src/transport.ts`
  once a third flow needs it (extract, do not copy).
- **Tests**: unit (mocked axios) + e2e (real org, env-gated) for each flow;
  coverage floor 80 % stays.
- **Docs**: README "Which flow?" table updated in the same change; ECA
  wording first, Connected App second.

## 4. Open questions to settle before 0.8

1. Salesforce may accept `private_key_jwt` client authentication
   (`client_assertion`) on the token endpoint for ECAs — verify against a
   live org before adding it to the client-auth option.
2. Public-client variant of the authorization-code-and-credentials flow:
   confirm parameter set on a real Experience Cloud site.
3. Keep `requestAuthCode()`'s network round-trip behaviour, or deprecate it
   in favour of `buildAuthorizeUrl()` immediately?
4. Package as one entry point or per-flow subpath exports
   (`client-sf-oauth/refresh`) to keep tree-shaking honest?

## 5. Sources

- Salesforce Help — OAuth Authorization Flows overview:
  https://help.salesforce.com/s/articleView?language=en_US&id=remoteaccess_authenticate_overview.htm
- Client credentials flow:
  https://help.salesforce.com/s/articleView?language=en_US&id=sf.remoteaccess_oauth_client_credentials_flow.htm
- Device flow: https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_oauth_device_flow_ca.htm
- Authorization code and credentials flow (private clients):
  https://help.salesforce.com/s/articleView?language=en_US&id=xcloud.remoteaccess_authorization_code_credentials_flow.htm
- Asset token flow: https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_asset_token_flow.htm
- Device-flow restriction and Connected App → ECA schedule:
  https://www.softwareinsights.dev/posts/salesforce-oauth-device-flow-external-client-apps/
