# Friendenza

Friendenza is an authorized Rare Friends community project. A holder connects a
wallet, selects a Rare Friends Genesis NFT, previews deterministic grayscale
pixel art derived from its token ID, traits, and tonal profile, then claims one
Friendenza ERC-721 for that source token.

The source Genesis contract is provisionally configured as
`0x116EaA62241751E0c98dA43d458600c6C17cD361` on Robinhood Chain. Reconfirm it
with the Rare Friends team before mainnet deployment.

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

Mainnet deployment requires separate approval, confirmation of the source
contract and branding, a royalty/fee decision, and successful manual testnet
wallet/marketplace verification.
