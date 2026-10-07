# Fonepoints Business backend

Holds the OMS company API key and spends it on the portal's behalf. Express 5, TypeScript run
directly by Node (no build step), port **4000**.

```bash
npm install
npm run dev        # http://localhost:4000, restarts on edit
```

Node runs the `.ts` files as they are, so what executes is what is on disk. No bundler, no
`dist/`, no source maps to keep in step.

## Why this service exists

One reason: **the OMS company API key must not reach a browser.**

The merchant presses OMS in the portal. The Angular app cannot ask the OMS backend for an access
token — it holds no credential OMS would accept — so it asks this service, which presents the key
and hands back the token OMS issues.

```
Angular portal ──session cookie──▶ POST /api/oms/token
                                        │
                                        ├─ x-api-key ──▶ oms-backend POST /api/v1/auth/token
                                        │                       │
                                        ◀───────────────────────┘ access token
                                        │
                   access token ◀───────┘   (posted into the OMS iframe)
```

Three properties make the extra hop worth it:

- **The key never leaves this process.** It is used in exactly one file, `src/oms-client.ts`, so
  that is a claim you can check by reading one file rather than auditing a codebase.
- **Which merchant the token is for comes from the session**, never from the request body. A
  signed-in merchant cannot ask for another merchant's token by editing a payload.
- **This service decides nothing.** It does not mint, sign or validate a token — it carries a
  request it is allowed to make, which is why it can stay this small.

## Routes

| Route | |
|---|---|
| `POST /api/auth/login` | dummy sign-in: any email, no password |
| `GET /api/auth/session` | the current portal user, or 401 |
| `POST /api/auth/logout` | ends the session |
| `GET /api/auth/users` | the accounts a demo can sign in as |
| `POST /api/oms/token` | **the handoff** — session required |
| `POST /api/oms/orders` | push an order into OMS (the key's other use) |
| `GET /api/oms/health` | proxied OMS liveness |
| `GET /api/health` | this service's own liveness |

## The dummy parts

Sign-in is an email lookup against `src/users.ts`, and any email signs in — there is no Fonepoints
identity provider to talk to in this phase. Sessions are a `Map` in memory, so they end when the
process restarts.

What is *not* dummy is the shape: a session must exist before `/api/oms/token` will spend the key,
and the merchant it is spent for comes from that session. Replacing the demo sign-in with the real
portal identity means changing `src/routes/auth.ts` and `src/users.ts`, and nothing downstream —
everything past that point only reads `omsMerchantRef`.

| Email | Merchant in OMS |
|---|---|
| `merchant@fonepoints.local` | Hamro Mobile (`fp-hamro-mobile`) |
| `gadget@fonepoints.local` | Gadget Ghar (`fp-gadget-ghar`) |

## Configuration

See `.env.example`. The one value that matters is `OMS_API_KEY`, which must match
`OMS_COMPANY_API_KEY` in `oms-backend` — both default to the same development placeholder, which
is why the flow works with no setup and why `/api/health` reports when the placeholder is still in
use.

CORS allows one configured origin with `credentials: true`, never `*`. The two go together: a
browser refuses to send cookies to a wildcard origin, and a wildcard would let any page call this
API with the merchant's session and read the OMS token out of the response.
