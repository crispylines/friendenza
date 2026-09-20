import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { targetChain, targetRpcUrl } from "@/lib/web3/config";
import {
  discoverOwnedGenesis,
  GENESIS_ABI,
  GENESIS_CONTRACT,
  genesisTokenFromDataUri,
  serializeGenesisToken,
  verifyGenesisOwnership,
} from "@/lib/web3/genesis";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    const client = createPublicClient({
      chain: targetChain,
      transport: http(targetRpcUrl),
    });
    const indexedTokens = await discoverOwnedGenesis(address);
    const verifiedTokens = (
      await Promise.all(
        indexedTokens.map(async (token) => {
          const owned = await verifyGenesisOwnership(address, token.tokenId, async (tokenId) =>
            client.readContract({
              address: GENESIS_CONTRACT,
              abi: GENESIS_ABI,
              functionName: "ownerOf",
              args: [tokenId],
            }),
          );
          return owned ? token : null;
        }),
      )
    ).filter((token) => token !== null);
    const configuredTestToken = process.env.NEXT_PUBLIC_TEST_TOKEN_ID;
    if (
      targetChain.testnet &&
      configuredTestToken &&
      !verifiedTokens.some((token) => token.tokenId.toString() === configuredTestToken)
    ) {
      const testTokenId = BigInt(configuredTestToken);
      const owned = await verifyGenesisOwnership(address, testTokenId, (tokenId) =>
        client.readContract({
          address: GENESIS_CONTRACT,
          abi: GENESIS_ABI,
          functionName: "ownerOf",
          args: [tokenId],
        }),
      );
      if (owned) {
        const tokenUri = await client.readContract({
          address: GENESIS_CONTRACT,
          abi: GENESIS_ABI,
          functionName: "tokenURI",
          args: [testTokenId],
        });
        const token = genesisTokenFromDataUri(testTokenId, tokenUri);
        if (token) verifiedTokens.push(token);
      }
    }

    return NextResponse.json({
      contract: GENESIS_CONTRACT,
      chainId: targetChain.id,
      tokens: verifiedTokens.map(serializeGenesisToken),
    });
  } catch (error) {
    console.error("[genesis-discovery] Unable to load verified tokens", {
      address,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Unable to load Rare Friends right now. Please retry." },
      { status: 502 },
    );
  }
}
