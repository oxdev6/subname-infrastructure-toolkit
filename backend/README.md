# Backend API

Minimal issuance API for the ENS Subname Infrastructure Toolkit.

## Endpoints

- `POST /mint-subname`
  - body: `{ "label": "alice", "recipient": "0x...", "expiresAt": 1760000000 }`
- `POST /revoke-subname`
  - body: `{ "label": "alice" }`
- `GET /subname-status?label=alice`
- `POST /claim-links`
  - body: `{ "label": "alice", "expiresAt": 1760000000, "maxClaims": 1 }`
- `GET /claim-links/challenge?token=...&recipient=0x...`
  - returns a domain-bound message and one-time `challengeNonce` for wallet signature
- `POST /claim-links/redeem`
  - body: `{ "token": "...", "recipient": "0x...", "challengeNonce": "...", "walletSignature": "0x..." }`
- `GET /analytics`
  - returns aggregate metrics (`totalSubnames`, `activeSubnames`, `revokedSubnames`, `uniqueHolders`)
- `GET /events/recent?limit=25`
  - returns recently indexed mint/revoke events

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Ensure contract artifacts are generated (`npm run test:contracts` in root).
3. Start API:

```bash
npm --workspace backend run dev
```

## Tests

```bash
npm --workspace backend test
```
