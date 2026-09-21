import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { targetChain, targetRpcUrl } from "@/lib/web3/config";
import {
  discoverOwnedGenesis,
  fetchGenesisTokenFromUri,
  GENESIS_ABI,
  GENESIS_CONTRACT,
  serializeGenesisToken,
  verifyGenesisOwnership,
} from "@/lib/web3/genesis";
import {
  CLAIMS_CONFIGURED,
  FRIENDENZA_ABI,
  FRIENDENZA_CONTRACT,
} from "@/lib/web3/friendenza";

export const runtime = "nodejs";
export const maxDuration = 30;

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
          if (!owned) return null;
          if (token.imageUrl) return token;
          const tokenUri = await client.readContract({
            address: GENESIS_CONTRACT,
            abi: GENESIS_ABI,
            functionName: "tokenURI",
            args: [token.tokenId],
          });
          const onChainToken = await fetchGenesisTokenFromUri(token.tokenId, tokenUri);
          return onChainToken
            ? {
                ...onChainToken,
                ...token,
                imageUrl: onChainToken.imageUrl,
                traits:
                  Object.keys(token.traits).length > 0
                    ? token.traits
                    : onChainToken.traits,
              }
            : token;
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
        const token = await fetchGenesisTokenFromUri(testTokenId, tokenUri);
        if (token) verifiedTokens.push(token);
      }
    }

    const serializedTokens = await Promise.all(
      verifiedTokens.map(async (token) => ({
        ...serializeGenesisToken(token),
        claimed: CLAIMS_CONFIGURED
          ? await client.readContract({
              address: FRIENDENZA_CONTRACT,
              abi: FRIENDENZA_ABI,
              functionName: "claimed",
              args: [token.tokenId],
            })
          : false,
      })),
    );

    return NextResponse.json({
      contract: GENESIS_CONTRACT,
      chainId: targetChain.id,
      tokens: serializedTokens,
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
