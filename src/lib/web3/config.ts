import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  testnet: true,
});

const configuredTargetChainId = Number(
  process.env.NEXT_PUBLIC_TARGET_CHAIN_ID ?? robinhood.id,
);

export const targetChain =
  configuredTargetChainId === robinhoodTestnet.id ? robinhoodTestnet : robinhood;

export const targetRpcUrl =
  process.env.ROBINHOOD_RPC_URL ?? targetChain.rpcUrls.default.http[0];

export const blockscoutApiBase = `${targetChain.blockExplorers.default.url}/api/v2`;

export const wagmiConfig = createConfig({
  chains: [robinhood, robinhoodTestnet],
  connectors: [injected()],
  transports: {
    [robinhood.id]: http(),
    [robinhoodTestnet.id]: http(),
  },
  ssr: true,
});
