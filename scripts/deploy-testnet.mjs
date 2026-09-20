import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const source = await readFile(envPath, "utf8");
const lines = source.split(/\r?\n/);
const values = new Map();

for (const line of lines) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) values.set(match[1], match[2].trim());
}

for (const key of [
  "DEPLOYER_PRIVATE_KEY",
  "AUTHORIZATION_SIGNER",
  "CONTRACT_OWNER",
  "TEST_HOLDER",
]) {
  if (!values.get(key)) throw new Error(`${key} is missing from .env.local`);
}

const forge = path.join(root, ".foundry", "forge.exe");
const rpcUrl =
  values.get("ROBINHOOD_RPC_URL") ?? "https://rpc.testnet.chain.robinhood.com";
const result = spawnSync(
  forge,
  [
    "script",
    "script/DeployTestnet.s.sol:DeployTestnet",
    "--rpc-url",
    rpcUrl,
    "--broadcast",
    "-vvv",
  ],
  {
    cwd: path.join(root, "contracts"),
    env: { ...process.env, ...Object.fromEntries(values) },
    encoding: "utf8",
  },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);

const combined = `${result.stdout}\n${result.stderr}`;
const genesis = combined.match(/Mock Genesis deployed at (0x[0-9a-fA-F]{40})/)?.[1];
const friendenza = combined.match(/Friendenza deployed at (0x[0-9a-fA-F]{40})/)?.[1];
if (!genesis || !friendenza) {
  throw new Error("Deployment succeeded but contract addresses could not be parsed");
}

const updates = new Map([
  ["NEXT_PUBLIC_GENESIS_CONTRACT", genesis],
  ["NEXT_PUBLIC_FRIENDENZA_CONTRACT", friendenza],
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

console.log(`Saved testnet Genesis address: ${genesis}`);
console.log(`Saved testnet Friendenza address: ${friendenza}`);
