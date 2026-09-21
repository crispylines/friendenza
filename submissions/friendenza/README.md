# Friendenza

Turn an owned Rare Friends Genesis NFT into one deterministic black, white and
grayscale pixel-flow artwork, then claim it as a one-per-Friend NFT.

**Builder:** [@crispylines](https://github.com/crispylines)  
**Category:** Character Spotlight  
**Stack:** Next.js 16, React 19, wagmi/viem, Foundry, Pinata/IPFS  
**FriendSDK:** Not used. Friendenza is a custom NFT art tool rather than an SDK
game, and it targets the Rare Friends Genesis contract instead of the
Generations identity required by FriendSDK.

## Try it

- Demo: [https://friendenza.com](https://friendenza.com)
- Source: [https://github.com/crispylines/friendenza](https://github.com/crispylines/friendenza)

Use a browser wallet holding a Rare Friends Genesis NFT on Robinhood mainnet
(chain 4663). Connect the owner wallet, select a Friend, and choose
**Generate Friendenza**. The app verifies ownership on-chain and visibly builds
a deterministic composition from the token ID, traits, and source tonal
profile. If satisfied, choose **Claim Friendenza**, sign the free authentication
message, and separately confirm the mint transaction.

The same source token always produces the same versioned artwork. Composition
families include parallel ribbons, waves, curls, single and double vortices,
radial fans, weaves, and meanders. Art remains crisp, pixel-aligned, and limited
to an eight-tone grayscale palette.

## Contract behavior and costs

The claim contract permits one Friendenza for each Rare Friends Genesis token.
It rechecks current Genesis ownership during the mint and verifies a short-lived
EIP-712 authorization binding the recipient, source token, metadata digest,
IPFS URI, and deadline.

There is no mint price, purchase, reward, token economy, or royalty. The holder
pays only Robinhood network gas when confirming the claim. Connecting,
discovering Friends, generating previews, and signing the authentication
message do not transfer funds or approve NFTs.

## Checks and limitations

Run:

```sh
npm ci
npm test
npm run test:mainnet-tooling
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm audit
forge test --root contracts
```

Automated coverage includes deterministic and diverse art generation,
grayscale/pixel constraints, mainnet metadata fallback, ownership checks,
already-claimed protection, wallet challenge integrity, IPFS authorization,
responsive browser journeys, duplicate claims, transferred-source ownership,
expired and invalid signatures, front-running, signer rotation, and
reentrancy.

Friendenza supports injected browser wallets; WalletConnect and native deep
links are not currently included. Discovery depends on Robinhood Blockscout
with an on-chain metadata fallback. Metadata and SVG assets are pinned through
Pinata/IPFS. Claims are real, irreversible blockchain transactions, so users
must verify Robinhood mainnet and review the wallet confirmation. Friendenza is
an authorized Rare Friends community project, not the official Rare Friends
website.
