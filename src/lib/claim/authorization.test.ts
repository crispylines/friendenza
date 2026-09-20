import { describe, expect, it, vi } from "vitest";
import { verifyTypedData, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildFriendenzaArtifact } from "@/lib/art/pipeline";
import { GENESIS_CONTRACT } from "@/lib/web3/genesis";
import { prepareClaimAuthorization } from "./authorization";

const privateKey = `0x${"11".repeat(32)}` as Hex;
const signer = privateKeyToAccount(privateKey);
const recipient = "0x1111111111111111111111111111111111111111";
const claimContract = "0x2222222222222222222222222222222222222222";

describe("prepareClaimAuthorization", () => {
  it("pins deterministic content and signs contract-compatible typed data", async () => {
    const artifact = buildFriendenzaArtifact({
      chainId: 4663,
      contract: GENESIS_CONTRACT,
      tokenId: 42n,
      generatorVersion: "friendenza-v1",
      name: "Rare Friend #42",
      traits: { Eyes: "Laser" },
      sourceMetadata: { name: "Rare Friend #42" },
      tonalProfile: {
        mean: 0.5,
        contrast: 0.8,
        histogram: [0.1, 0.1, 0.1, 0.2, 0.2, 0.1, 0.1, 0.1],
      },
    });
    const pinSvg = vi.fn(async () => "bafy-svg");
    const pinJson = vi.fn(async () => "bafy-json");

    const claim = await prepareClaimAuthorization(
      { recipient, artifact },
      {
        chainId: 4663,
        claimContract,
        privateKey,
        pinSvg,
        pinJson,
        nowSeconds: 1_000,
      },
    );

    expect(claim.tokenUri).toBe("ipfs://bafy-json");
    expect(claim.deadline).toBe(1_900);
    expect(pinSvg).toHaveBeenCalledOnce();
    expect(pinJson).toHaveBeenCalledOnce();
    expect(claim.idempotencyKey).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(
      verifyTypedData({
        address: signer.address,
        domain: claim.typedData.domain,
        types: claim.typedData.types,
        primaryType: "Claim",
        message: claim.typedData.message,
        signature: claim.signature,
      }),
    ).resolves.toBe(true);
  });
});
