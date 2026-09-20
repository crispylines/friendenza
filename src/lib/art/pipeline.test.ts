import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { GENESIS_CONTRACT } from "@/lib/web3/genesis";
import {
  buildFriendenzaArtifact,
  deriveCanonicalSeed,
  extractTonalProfile,
} from "./pipeline";

describe("canonical Friendenza art pipeline", () => {
  it("derives the same seed regardless of metadata key order", () => {
    const first = deriveCanonicalSeed({
      chainId: 4663,
      contract: GENESIS_CONTRACT,
      tokenId: 42n,
      generatorVersion: "friendenza-v1",
      metadata: { name: "Friend", traits: { Eyes: "Laser", Body: "Robot" } },
    });
    const second = deriveCanonicalSeed({
      chainId: 4663,
      contract: GENESIS_CONTRACT,
      tokenId: 42n,
      generatorVersion: "friendenza-v1",
      metadata: { traits: { Body: "Robot", Eyes: "Laser" }, name: "Friend" },
    });

    expect(first).toEqual(second);
    expect(
      deriveCanonicalSeed({
        chainId: 4663,
        contract: GENESIS_CONTRACT,
        tokenId: 43n,
        generatorVersion: "friendenza-v1",
        metadata: { name: "Friend", traits: { Eyes: "Laser", Body: "Robot" } },
      }).seedHex,
    ).not.toBe(first.seedHex);
  });

  it("extracts a normalized grayscale tonal profile from image bytes", async () => {
    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: "#000000",
      },
    })
      .composite([
        {
          input: {
            create: {
              width: 1,
              height: 2,
              channels: 3,
              background: "#ffffff",
            },
          },
          left: 1,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

    const profile = await extractTonalProfile(dataUrl);

    expect(profile.mean).toBeGreaterThan(0.45);
    expect(profile.mean).toBeLessThan(0.55);
    expect(profile.contrast).toBeGreaterThan(0.8);
    expect(profile.histogram).toHaveLength(8);
    expect(profile.histogram.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 5);
  });

  it("builds reproducible SVG and provenance hashes", () => {
    const input = {
      chainId: 4663,
      contract: GENESIS_CONTRACT,
      tokenId: 42n,
      generatorVersion: "friendenza-v1",
      name: "Rare Friend #42",
      traits: { Eyes: "Laser" },
      sourceMetadata: { name: "Rare Friend #42", attributes: [{ trait_type: "Eyes", value: "Laser" }] },
      tonalProfile: {
        mean: 0.5,
        contrast: 0.7,
        histogram: [0.1, 0.1, 0.1, 0.2, 0.2, 0.1, 0.1, 0.1],
      },
    };

    const first = buildFriendenzaArtifact(input);
    const second = buildFriendenzaArtifact(input);

    expect(first).toEqual(second);
    expect(first.svgDigest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.metadataDigest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.svg).toContain('shape-rendering="crispEdges"');
    expect(first.metadata.attributes).toContainEqual({
      trait_type: "Source Rare Friend",
      value: "42",
    });
  });
});
