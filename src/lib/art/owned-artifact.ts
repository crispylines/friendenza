import { createPublicClient, http } from "viem";
import { buildFriendenzaArtifact, extractTonalProfile } from "./pipeline";
import { targetChain, targetRpcUrl } from "@/lib/web3/config";
import {
  discoverOwnedGenesis,
  fetchGenesisTokenFromUri,
  GENESIS_ABI,
  GENESIS_CONTRACT,
  verifyGenesisOwnership,
} from "@/lib/web3/genesis";

export async function prepareOwnedArtifact(address: string, tokenId: bigint) {
  const client = createPublicClient({
    chain: targetChain,
    transport: http(targetRpcUrl),
  });
  const tokens = await discoverOwnedGenesis(address).catch((error) => {
    console.warn("[owned-artifact] Indexer lookup failed; using on-chain metadata", {
      address,
      tokenId: tokenId.toString(),
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  });
  let token = tokens.find((candidate) => candidate.tokenId === tokenId);
  const owned = await verifyGenesisOwnership(address, tokenId, (id) =>
    client.readContract({
      address: GENESIS_CONTRACT,
      abi: GENESIS_ABI,
      functionName: "ownerOf",
      args: [id],
    }),
  );
  if (!owned) throw new Error("Wallet no longer owns this Rare Friend");

  if (!token?.imageUrl) {
    const tokenUri = await client.readContract({
      address: GENESIS_CONTRACT,
      abi: GENESIS_ABI,
      functionName: "tokenURI",
      args: [tokenId],
    });
    const onChainToken = await fetchGenesisTokenFromUri(tokenId, tokenUri);
    if (onChainToken) {
      token = token
        ? {
            ...onChainToken,
            ...token,
            imageUrl: token.imageUrl ?? onChainToken.imageUrl,
            traits:
              Object.keys(token.traits).length > 0
                ? token.traits
                : onChainToken.traits,
          }
        : onChainToken;
    }
  }
  if (!token) throw new Error("Rare Friend was not found in this wallet");
  if (!token.imageUrl) throw new Error("Rare Friend image is unavailable");

  const sourceMetadata = {
    name: token.name,
    image: token.imageUrl,
    attributes: Object.entries(token.traits).map(([trait_type, value]) => ({
      trait_type,
      value,
    })),
  };
  const tonalProfile = await extractTonalProfile(token.imageUrl);
  const artifact = buildFriendenzaArtifact({
    chainId: targetChain.id,
    contract: GENESIS_CONTRACT,
    tokenId,
    generatorVersion: "friendenza-v4",
    name: token.name,
    traits: token.traits,
    sourceMetadata,
    tonalProfile,
  });

  return { token, artifact };
}
