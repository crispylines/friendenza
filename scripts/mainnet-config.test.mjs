import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  CONFIRMED_GENESIS,
  MAINNET_CHAIN_ID,
  MIN_DEPLOYER_BALANCE_WEI,
  buildForgeArguments,
  buildVerifyArguments,
  parseDeploymentAddress,
  validateMainnetConfig,
} from "./mainnet-config.mjs";

const deployerKey = `0x${"1".repeat(64)}`;
const authorizationKey = `0x${"2".repeat(64)}`;
const deployer = privateKeyToAccount(deployerKey);
const signer = privateKeyToAccount(authorizationKey);
const values = new Map([
  ["DEPLOYER_PRIVATE_KEY", deployerKey],
  ["AUTHORIZATION_PRIVATE_KEY", authorizationKey],
  ["AUTHORIZATION_SIGNER", signer.address],
  ["CONTRACT_OWNER", deployer.address],
  ["GENESIS_CONTRACT", CONFIRMED_GENESIS],
  ["NEXT_PUBLIC_TARGET_CHAIN_ID", String(MAINNET_CHAIN_ID)],
  ["NEXT_PUBLIC_SITE_URL", "https://friendenza.com"],
  ["ROBINHOOD_RPC_URL", "https://rpc.mainnet.chain.robinhood.com"],
  ["PINATA_JWT", "production-pinata-jwt"],
  ["CHALLENGE_SECRET", "a".repeat(48)],
]);

describe("mainnet deployment configuration", () => {
  it("accepts the confirmed chain, contracts, roles, and funded deployer", () => {
    const config = validateMainnetConfig(values, {
      chainId: MAINNET_CHAIN_ID,
      balanceWei: MIN_DEPLOYER_BALANCE_WEI,
    });

    assert.equal(config.deployer, deployer.address);
    assert.equal(config.authorizationSigner, signer.address);
    assert.equal(config.contractOwner, deployer.address);
    assert.equal(config.genesis, CONFIRMED_GENESIS);
  });

  it("fails closed for wrong chain, Genesis, signer, owner, or balance", () => {
    assert.throws(
      () =>
        validateMainnetConfig(values, {
          chainId: 46630,
          balanceWei: MIN_DEPLOYER_BALANCE_WEI,
        }),
      /chain/i,
    );

    const wrongGenesis = new Map(values);
    wrongGenesis.set("GENESIS_CONTRACT", "0x0000000000000000000000000000000000000001");
    assert.throws(
      () =>
        validateMainnetConfig(wrongGenesis, {
          chainId: MAINNET_CHAIN_ID,
          balanceWei: MIN_DEPLOYER_BALANCE_WEI,
        }),
      /Genesis/i,
    );

    const wrongSigner = new Map(values);
    wrongSigner.set("AUTHORIZATION_SIGNER", deployer.address);
    assert.throws(
      () =>
        validateMainnetConfig(wrongSigner, {
          chainId: MAINNET_CHAIN_ID,
          balanceWei: MIN_DEPLOYER_BALANCE_WEI,
        }),
      /signer/i,
    );

    const wrongOwner = new Map(values);
    wrongOwner.set("CONTRACT_OWNER", signer.address);
    assert.throws(
      () =>
        validateMainnetConfig(wrongOwner, {
          chainId: MAINNET_CHAIN_ID,
          balanceWei: MIN_DEPLOYER_BALANCE_WEI,
        }),
      /owner/i,
    );

    assert.throws(
      () =>
        validateMainnetConfig(values, {
          chainId: MAINNET_CHAIN_ID,
          balanceWei: MIN_DEPLOYER_BALANCE_WEI - 1n,
        }),
      /balance/i,
    );
  });

  it("keeps dry runs non-broadcasting and separates source verification", () => {
    const dryRun = buildForgeArguments({ broadcast: false });
    assert.equal(dryRun.includes("--broadcast"), false);

    const broadcast = buildForgeArguments({ broadcast: true });
    assert.equal(broadcast.includes("--broadcast"), true);
    assert.equal(broadcast.includes("--verify"), false);

    const verify = buildVerifyArguments({
      contract: "0x1234567890123456789012345678901234567890",
      constructorArgs: "0x1234",
    });
    assert.equal(verify.includes("verify-contract"), true);
    assert.equal(verify.includes("blockscout"), true);
    assert.equal(verify.includes("--watch"), true);
  });

  it("parses only a valid deployed Friendenza address", () => {
    assert.equal(
      parseDeploymentAddress(
        "Friendenza deployed at 0x1234567890123456789012345678901234567890",
      ),
      "0x1234567890123456789012345678901234567890",
    );
    assert.throws(() => parseDeploymentAddress("deployment failed"), /could not be parsed/i);
  });
});
