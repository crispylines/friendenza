import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  CONFIRMED_GENESIS,
  MAINNET_CHAIN_ID,
  MAINNET_RPC_URL,
  parseEnv,
  updateEnv,
} from "./mainnet-config.mjs";

const localEnvPath = new URL("../.env.local", import.meta.url);
const mainnetEnvPath = new URL("../.env.mainnet.local", import.meta.url);
const localSource = await readFile(localEnvPath, "utf8").catch(() => "");
const mainnetSource = await readFile(mainnetEnvPath, "utf8").catch(() => "");
const localValues = parseEnv(localSource);
const mainnetValues = parseEnv(mainnetSource);

const deployerKey =
  mainnetValues.get("DEPLOYER_PRIVATE_KEY") ??
  localValues.get("DEPLOYER_PRIVATE_KEY") ??
  "";
if (!/^0x[0-9a-f]{64}$/i.test(deployerKey)) {
  throw new Error(
    "DEPLOYER_PRIVATE_KEY is missing; add the funded owner wallet key to .env.local",
  );
}

const authorizationKey =
  mainnetValues.get("AUTHORIZATION_PRIVATE_KEY") ?? generatePrivateKey();
const deployer = privateKeyToAccount(deployerKey);
const authorizationSigner = privateKeyToAccount(authorizationKey);
const updates = new Map([
  ["NEXT_PUBLIC_TARGET_CHAIN_ID", String(MAINNET_CHAIN_ID)],
  ["NEXT_PUBLIC_GENESIS_CONTRACT", CONFIRMED_GENESIS],
  ["NEXT_PUBLIC_FRIENDENZA_CONTRACT", "0x0000000000000000000000000000000000000000"],
  ["NEXT_PUBLIC_TEST_TOKEN_ID", ""],
  ["NEXT_PUBLIC_SITE_URL", "https://friendenza.com"],
  ["ROBINHOOD_RPC_URL", MAINNET_RPC_URL],
  ["IPFS_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs/"],
  ["GENESIS_CONTRACT", CONFIRMED_GENESIS],
  ["DEPLOYER_PRIVATE_KEY", deployerKey],
  ["AUTHORIZATION_PRIVATE_KEY", authorizationKey],
  ["AUTHORIZATION_SIGNER", authorizationSigner.address],
  ["CONTRACT_OWNER", deployer.address],
  [
    "CHALLENGE_SECRET",
    mainnetValues.get("CHALLENGE_SECRET") ?? randomBytes(48).toString("base64url"),
  ],
  ["PINATA_JWT", mainnetValues.get("PINATA_JWT") ?? ""],
  ["MAINNET_BROADCAST_CONFIRMATION", ""],
]);

await writeFile(mainnetEnvPath, updateEnv(mainnetSource, updates), "utf8");

console.log(`Mainnet deployer/owner: ${deployer.address}`);
console.log(`Mainnet authorization signer: ${authorizationSigner.address}`);
console.log("Created .env.mainnet.local without printing secrets.");
if (!mainnetValues.get("PINATA_JWT")) {
  console.log("Next required input: add the production Pinata Picnic JWT.");
}
