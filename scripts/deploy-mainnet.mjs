import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  encodeAbiParameters,
  formatEther,
  getAddress,
  http,
  keccak256,
  parseAbiParameters,
  zeroAddress,
} from "viem";
import {
  BROADCAST_CONFIRMATION,
  buildForgeArguments,
  buildVerifyArguments,
  parseDeploymentAddress,
  parseEnv,
  updateEnv,
  validateMainnetConfig,
} from "./mainnet-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractsRoot = path.join(root, "contracts");
const envPath = path.join(root, ".env.mainnet.local");
const source = await readFile(envPath, "utf8");
const values = parseEnv(source);
const rpcUrl = values.get("ROBINHOOD_RPC_URL");
if (!rpcUrl) throw new Error("ROBINHOOD_RPC_URL is missing from .env.mainnet.local");

const client = createPublicClient({ transport: http(rpcUrl) });
const chainId = await client.getChainId();
const deployerKey = values.get("DEPLOYER_PRIVATE_KEY");
if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY is missing");
const { privateKeyToAccount } = await import("viem/accounts");
const deployer = privateKeyToAccount(deployerKey);
const balanceWei = await client.getBalance({ address: deployer.address });
const config = validateMainnetConfig(values, { chainId, balanceWei });

const genesisAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
];
const [genesisName, genesisSymbol] = await Promise.all([
  client.readContract({
    address: config.genesis,
    abi: genesisAbi,
    functionName: "name",
  }),
  client.readContract({
    address: config.genesis,
    abi: genesisAbi,
    functionName: "symbol",
  }),
]);
if (genesisName !== "Rare Friends Genesis" || genesisSymbol !== "GENESIS") {
  throw new Error(
    `Genesis identity mismatch: received ${genesisName} (${genesisSymbol})`,
  );
}

const broadcast = process.argv.includes("--broadcast");
if (
  broadcast &&
  values.get("MAINNET_BROADCAST_CONFIRMATION") !== BROADCAST_CONFIRMATION
) {
  throw new Error(
    `Broadcast blocked: set MAINNET_BROADCAST_CONFIRMATION=${BROADCAST_CONFIRMATION}`,
  );
}
const configuredContract = values.get("NEXT_PUBLIC_FRIENDENZA_CONTRACT");
if (
  broadcast &&
  configuredContract &&
  getAddress(configuredContract) !== zeroAddress
) {
  throw new Error("Broadcast blocked: a mainnet Friendenza address is already configured");
}

const forge = path.join(
  root,
  ".foundry",
  process.platform === "win32" ? "forge.exe" : "forge",
);
const childEnvironment = { ...process.env, ...Object.fromEntries(values) };
const inspect = spawnSync(
  forge,
  ["inspect", "src/Friendenza.sol:Friendenza", "bytecode"],
  {
    cwd: contractsRoot,
    env: childEnvironment,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  },
);
if (inspect.status !== 0) {
  if (inspect.stderr) process.stderr.write(inspect.stderr);
  process.exit(inspect.status ?? 1);
}
const bytecode = inspect.stdout.trim();
if (!/^0x[0-9a-f]+$/i.test(bytecode)) {
  throw new Error("Unable to inspect Friendenza creation bytecode");
}

console.log("Friendenza mainnet preflight");
console.log(`Chain: ${chainId}`);
console.log(`Genesis: ${config.genesis} (${genesisName} / ${genesisSymbol})`);
console.log(`Deployer/owner: ${config.deployer}`);
console.log(`Authorization signer: ${config.authorizationSigner}`);
console.log(`Deployer balance: ${formatEther(balanceWei)} ETH`);
console.log(`Creation bytecode keccak256: ${keccak256(bytecode)}`);
console.log(`Mode: ${broadcast ? "BROADCAST" : "DRY RUN"}`);

const result = spawnSync(
  forge,
  buildForgeArguments({ broadcast, rpcUrl }),
  {
    cwd: contractsRoot,
    env: childEnvironment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  },
);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);

const output = `${result.stdout}\n${result.stderr}`;
const friendenza = parseDeploymentAddress(output);
if (!broadcast) {
  console.log(`Dry-run contract address: ${friendenza}`);
  console.log("No transaction was broadcast and no environment file was changed.");
  process.exit(0);
}

const updates = new Map([
  ["NEXT_PUBLIC_FRIENDENZA_CONTRACT", friendenza],
  ["MAINNET_BROADCAST_CONFIRMATION", ""],
]);
await writeFile(envPath, updateEnv(source, updates), "utf8");
console.log(`Saved mainnet Friendenza address: ${friendenza}`);

const constructorArgs = encodeAbiParameters(
  parseAbiParameters("address,address,address"),
  [config.genesis, config.authorizationSigner, config.contractOwner],
);
const verification = spawnSync(
  forge,
  buildVerifyArguments({ contract: friendenza, constructorArgs }),
  {
    cwd: contractsRoot,
    env: childEnvironment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  },
);
if (verification.stdout) process.stdout.write(verification.stdout);
if (verification.stderr) process.stderr.write(verification.stderr);
if (verification.status !== 0) {
  throw new Error(
    `Contract deployed at ${friendenza}, but Blockscout verification failed`,
  );
}
console.log(`Verified Friendenza source at ${friendenza}`);
