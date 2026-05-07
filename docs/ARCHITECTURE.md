# Architecture (Day 1)

## On-chain

- `SubnameRegistrar.sol`: issues, revokes, renews subnames scoped to a root domain.
- Role model:
  - `DEFAULT_ADMIN_ROLE`: protocol owner and policy operator
  - `MINTER_ROLE`: service/API mint authority
  - `SIGNER_ROLE`: EIP-712 offchain authorization signer

## Off-chain

- API receives issuance requests and either mints directly with minter role or verifies signatures.
- Indexer subscribes to `SubnameMinted`, `SubnameRevoked`, `SubnameRenewed`.
- Dashboard and SDK consume API + indexer.

## Security model

- Signature replay prevention via per-wallet nonces.
- Signature expiry (`deadline`).
- Label uniqueness by deterministic key (`label.root`).
- Revocation restricted to admin/minter.

