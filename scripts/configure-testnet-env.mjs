import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envPath = new URL("../.env.local", import.meta.url);
const source = await readFile(envPath, "utf8");
const lines = source.split(/\r?\n/);
const values = new Map();

for (const line of lines) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) values.set(match[1], match[2].trim());
}

let deployerKey = values.get("DEPLOYER_PRIVATE_KEY") ?? "";
if (deployerKey && !deployerKey.startsWith("0x")) deployerKey = `0x${deployerKey}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(deployerKey)) {
  throw new Error("DEPLOYER_PRIVATE_KEY is missing or malformed");
}
if (!values.get("PINATA_JWT")) {
  throw new Error("PINATA_JWT is missing");
}

const authorizationKey =
  values.get("AUTHORIZATION_PRIVATE_KEY") || generatePrivateKey();
const deployer = privateKeyToAccount(deployerKey);
const authorizationSigner = privateKeyToAccount(authorizationKey);

const updates = new Map([
  ["DEPLOYER_PRIVATE_KEY", deployerKey],
  ["NEXT_PUBLIC_TARGET_CHAIN_ID", "46630"],
  ["ROBINHOOD_RPC_URL", "https://rpc.testnet.chain.robinhood.com"],
  ["AUTHORIZATION_PRIVATE_KEY", authorizationKey],
  ["AUTHORIZATION_SIGNER", authorizationSigner.address],
  ["CONTRACT_OWNER", deployer.address],
  ["TEST_HOLDER", deployer.address],
  ["TEST_TOKEN_ID", "42"],
  ["NEXT_PUBLIC_TEST_TOKEN_ID", "42"],
  [
    "CHALLENGE_SECRET",
    values.get("CHALLENGE_SECRET") || randomBytes(48).toString("base64url"),
  ],
]);

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

await writeFile(envPath, `${output.filter(Boolean).join("\n")}\n`, "utf8");

console.log(`Contract owner/test holder: ${deployer.address}`);
console.log(`Authorization signer: ${authorizationSigner.address}`);
console.log("Testnet environment configured without printing secrets.");
