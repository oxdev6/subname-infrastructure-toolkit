# ENS Subname Toolkit SDK

JavaScript SDK for the ENS Subname Infrastructure Toolkit backend API.

## Install (workspace)

```bash
npm --workspace sdk install
```

## Usage

```js
import { createClient } from "ens-subname-toolkit";

const client = createClient({ apiBaseUrl: "http://localhost:4000" });

await client.createSubname("alice", "0xabc...", 1760000000);
const status = await client.getSubnameStatus("alice");
const analytics = await client.getAnalytics();
```

## Methods

- `createSubname(label, recipient, expiresAt)`
- `revokeSubname(label)`
- `resolveSubname(fqdnOrLabel)`
- `getSubnameStatus(label)`
- `createClaimLink(label, expiresAt, maxClaims?)`
- `getClaimChallenge(token, recipient)`
- `redeemClaim(token, recipient, challengeNonce, walletSignature)`
- `getAnalytics()`
- `getRecentEvents(limit?)`
