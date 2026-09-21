# Friendenza

Friendenza is an authorized Rare Friends community project. A holder connects a
wallet, selects a Rare Friends Genesis NFT, previews deterministic grayscale
pixel art derived from its token ID, traits, and tonal profile, then claims one
Friendenza ERC-721 for that source token.

The source Genesis contract is confirmed as
`0x116EaA62241751E0c98dA43d458600c6C17cD361` on Robinhood Chain (chain 4663).
Blockscout identifies it as `Rare Friends Genesis` / `GENESIS`.

## Local development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The landing page and disconnected holder journey work without secrets. Preview
and claim APIs require the values documented in `.env.example`.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm audit
.\.foundry\forge.exe test --root contracts
```

## Contracts

Foundry 1.7.1 is installed locally under `.foundry` and ignored by git. Contract
source, tests, and deployment scripts live in `contracts`. After cloning,
install the ignored contract libraries:

```powershell
forge install foundry-rs/forge-std --no-git --root contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git --root contracts
```

Current Robinhood testnet deployment:

- Mock Genesis: `0x0C8e38c1A5292a82Cf969f47b0657481b52aA9d6`
- Friendenza: `0x3739A3D7775dB11a957264D64C28dAfA4A403d5C`
- Mock token: `#42`

For a Robinhood testnet deployment, fund the deployment wallet with test ETH,
configure the private `.env.local`, then run:

```powershell
node scripts/configure-testnet-env.mjs
node scripts/deploy-testnet.mjs
```

Never commit deployment, authorization, Pinata, or challenge secrets. Use a
dedicated authorization signer that holds no user or treasury assets.

## Mainnet runbook

Mainnet configuration is kept in a separate git-ignored `.env.mainnet.local`.
The production launch uses `https://friendenza.com`, Pinata Picnic, no
ERC-2981 royalties, and a dedicated authorization signer that holds no user or
treasury assets.

1. Fund the approved deployer/owner wallet with at least `0.001 ETH` on
   Robinhood mainnet.
2. Run `npm run mainnet:configure`. This copies only the approved deployer key
   from `.env.local`, generates a new authorization key and challenge secret,
   and writes fixed chain/Genesis/domain values without printing secrets.
3. Add the production-scoped Pinata Picnic JWT to `.env.mainnet.local`.
4. Run `npm run mainnet:dry-run`. It fails closed for the wrong chain,
   Genesis, owner, signer, domain, RPC, or balance and prints the creation
   bytecode digest without broadcasting.
5. Review the exact preflight output. Only after explicit approval, set
   `MAINNET_BROADCAST_CONFIRMATION=DEPLOY_FRIENDENZA_MAINNET` in
   `.env.mainnet.local` and run `npm run mainnet:deploy`.

The broadcast script saves the deployed address before running separate
Blockscout source verification. If verification fails, do not redeploy:
the successful address remains in `.env.mainnet.local`; retry verification for
that address. If any immutable constructor value is wrong, do not configure
Vercel or invite claims—deploy a corrected replacement and clearly retire the
unused address.

After deployment, set these Vercel Production variables from
`.env.mainnet.local`:

- `NEXT_PUBLIC_TARGET_CHAIN_ID=4663`
- `NEXT_PUBLIC_GENESIS_CONTRACT`
- `NEXT_PUBLIC_FRIENDENZA_CONTRACT`
- `NEXT_PUBLIC_SITE_URL=https://friendenza.com`
- `ROBINHOOD_RPC_URL`
- `IPFS_GATEWAY_URL`
- `CHALLENGE_SECRET`
- `AUTHORIZATION_PRIVATE_KEY`
- `PINATA_JWT`

Do not add `DEPLOYER_PRIVATE_KEY`, `AUTHORIZATION_SIGNER`,
`CONTRACT_OWNER`, `MAINNET_BROADCAST_CONFIRMATION`, or any test-token variable
to Vercel. Before public promotion, use Vercel Firewall rate limits of roughly
30 challenge requests/minute/IP, 20 previews/minute/IP, and 5 claim
preparations/10 minutes/IP. Monitor 4xx/5xx rates, Pinata usage, RPC failures,
and signer balance. A compromised authorization signer is rotated with the
contract owner's `setAuthorizationSigner`; the owner key is never stored in
Vercel.
