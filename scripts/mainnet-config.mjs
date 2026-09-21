import {
  formatEther,
  getAddress,
  isAddress,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const MAINNET_CHAIN_ID = 4663;
export const CONFIRMED_GENESIS =
  "0x116EaA62241751E0c98dA43d458600c6C17cD361";
export const MAINNET_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const BLOCKSCOUT_API_URL = "https://robinhoodchain.blockscout.com/api/";
export const MIN_DEPLOYER_BALANCE_WEI = parseEther("0.001");
export const BROADCAST_CONFIRMATION = "DEPLOY_FRIENDENZA_MAINNET";

export function parseEnv(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2].trim());
  }
  return values;
}

export function updateEnv(source, updates) {
  const lines = source.split(/\r?\n/);
  const updatedKeys = new Set();
  const output = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match || !updates.has(match[1])) return line;
    updatedKeys.add(match[1]);
    return `${match[1]}=${updates.get(match[1])}`;
  });
  for (const [key, value] of updates) {
    if (!updatedKeys.has(key)) output.push(`${key}=${value}`);
  }
  return `${output.filter(Boolean).join("\n")}\n`;
}

function required(values, key) {
  const value = values.get(key);
  if (!value) throw new Error(`${key} is missing from .env.mainnet.local`);
  return value;
}

function privateKey(values, key) {
  const value = required(values, key);
  if (!/^0x[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${key} is malformed`);
  }
  return value;
}

function address(values, key) {
  const value = required(values, key);
  if (!isAddress(value)) throw new Error(`${key} is malformed`);
  return getAddress(value);
}

export function validateMainnetConfig(values, live) {
  if (live.chainId !== MAINNET_CHAIN_ID) {
    throw new Error(`Wrong chain: expected ${MAINNET_CHAIN_ID}, received ${live.chainId}`);
  }
  if (values.get("NEXT_PUBLIC_TARGET_CHAIN_ID") !== String(MAINNET_CHAIN_ID)) {
    throw new Error("NEXT_PUBLIC_TARGET_CHAIN_ID must target Robinhood mainnet");
  }

  const genesis = address(values, "GENESIS_CONTRACT");
  if (genesis !== getAddress(CONFIRMED_GENESIS)) {
    throw new Error(`Genesis must be the confirmed Rare Friends contract ${CONFIRMED_GENESIS}`);
  }

  const deployerKey = privateKey(values, "DEPLOYER_PRIVATE_KEY");
  const authorizationKey = privateKey(values, "AUTHORIZATION_PRIVATE_KEY");
  const deployer = privateKeyToAccount(deployerKey).address;
  const derivedSigner = privateKeyToAccount(authorizationKey).address;
  const configuredSigner = address(values, "AUTHORIZATION_SIGNER");
  const contractOwner = address(values, "CONTRACT_OWNER");

  if (configuredSigner !== derivedSigner) {
    throw new Error("Authorization signer does not match AUTHORIZATION_PRIVATE_KEY");
  }
  if (contractOwner !== deployer) {
    throw new Error("Contract owner must match the approved deployer wallet");
  }
  if (live.balanceWei < MIN_DEPLOYER_BALANCE_WEI) {
    throw new Error(
      `Deployer balance ${formatEther(live.balanceWei)} ETH is below the 0.001 ETH launch floor`,
    );
  }

  const rpcUrl = new URL(required(values, "ROBINHOOD_RPC_URL"));
  const expectedRpc = new URL(MAINNET_RPC_URL);
  if (
    rpcUrl.origin !== expectedRpc.origin ||
    rpcUrl.pathname !== expectedRpc.pathname
  ) {
    throw new Error(`ROBINHOOD_RPC_URL must be ${MAINNET_RPC_URL}`);
  }
  const siteUrl = new URL(required(values, "NEXT_PUBLIC_SITE_URL"));
  if (siteUrl.protocol !== "https:" || siteUrl.hostname !== "friendenza.com") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be https://friendenza.com");
  }
  if (required(values, "CHALLENGE_SECRET").length < 24) {
    throw new Error("CHALLENGE_SECRET must contain at least 24 characters");
  }
  required(values, "PINATA_JWT");

  return {
    deployer,
    authorizationSigner: derivedSigner,
    contractOwner,
    genesis,
    rpcUrl: MAINNET_RPC_URL,
    siteUrl: siteUrl.toString(),
  };
}

export function buildForgeArguments({ broadcast, rpcUrl = MAINNET_RPC_URL }) {
  const args = [
    "script",
    "script/DeployFriendenza.s.sol:DeployFriendenza",
    "--rpc-url",
    rpcUrl,
    "-vvv",
  ];
  if (broadcast) args.push("--broadcast", "--slow");
  return args;
}

export function buildVerifyArguments({ contract, constructorArgs }) {
  if (!isAddress(contract) || !/^0x[0-9a-f]*$/i.test(constructorArgs)) {
    throw new Error("Invalid verification arguments");
  }
  return [
    "verify-contract",
    getAddress(contract),
    "src/Friendenza.sol:Friendenza",
    "--chain-id",
    String(MAINNET_CHAIN_ID),
    "--verifier",
    "blockscout",
    "--verifier-url",
    BLOCKSCOUT_API_URL,
    "--constructor-args",
    constructorArgs,
    "--watch",
  ];
}

export function parseDeploymentAddress(output) {
  const match = output.match(/Friendenza deployed at (0x[0-9a-fA-F]{40})/);
  if (!match || !isAddress(match[1])) {
    throw new Error("Deployment address could not be parsed");
  }
  return getAddress(match[1]);
}
