import { describe, expect, it, vi } from "vitest";
import {
  GENESIS_CONTRACT,
  discoverOwnedGenesis,
  genesisTokenFromDataUri,
  verifyGenesisOwnership,
} from "./genesis";

const owner = "0x1111111111111111111111111111111111111111";

describe("Genesis ownership", () => {
  it("filters Blockscout NFTs to the official Genesis contract and normalizes traits", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: "42",
              image_url: "ipfs://friend-image",
              metadata: {
                name: "Rare Friend #42",
                attributes: [
                  { trait_type: "Eyes", value: "Laser" },
                  { trait_type: "Level", value: 3 },
                ],
              },
              token: {
                address_hash: GENESIS_CONTRACT,
                name: "Rare Friends Genesis",
                symbol: "GENESIS",
                type: "ERC-721",
              },
            },
            {
              id: "99",
              token: {
                address_hash: "0x2222222222222222222222222222222222222222",
              },
            },
          ],
          next_page_params: null,
        }),
        { status: 200 },
      ),
    );

    const tokens = await discoverOwnedGenesis(owner, fetcher);

    expect(tokens).toEqual([
      {
        tokenId: 42n,
        name: "Rare Friend #42",
        imageUrl: "ipfs://friend-image",
        traits: { Eyes: "Laser", Level: 3 },
      },
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects malformed addresses before making a network request", async () => {
    const fetcher = vi.fn();
    await expect(discoverOwnedGenesis("not-an-address", fetcher)).rejects.toThrow(
      "Invalid wallet address",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("verifies current ownerOf on-chain without trusting indexer data", async () => {
    const readOwner = vi.fn(async () => owner);

    await expect(verifyGenesisOwnership(owner, 42n, readOwner)).resolves.toBe(true);
    await expect(
      verifyGenesisOwnership(
        "0x3333333333333333333333333333333333333333",
        42n,
        readOwner,
      ),
    ).resolves.toBe(false);
    expect(readOwner).toHaveBeenCalledWith(42n);
  });

  it("decodes on-chain data metadata for the testnet mock", () => {
    const metadata = {
      name: "Test Rare Friend #42",
      image: "data:image/svg+xml;base64,PHN2Zy8+",
      attributes: [{ trait_type: "Eyes", value: "Pixel" }],
    };
    const tokenUri = `data:application/json;base64,${Buffer.from(
      JSON.stringify(metadata),
    ).toString("base64")}`;

    expect(genesisTokenFromDataUri(42n, tokenUri)).toEqual({
      tokenId: 42n,
      name: "Test Rare Friend #42",
      imageUrl: metadata.image,
      traits: { Eyes: "Pixel" },
    });
  });
});
