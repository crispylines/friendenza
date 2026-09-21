import { createPublicClient, http } from "viem";
import { buildFriendenzaArtifact, extractTonalProfile } from "./pipeline";
import { targetChain, targetRpcUrl } from "@/lib/web3/config";
import {
  discoverOwnedGenesis,
  GENESIS_ABI,
  GENESIS_CONTRACT,
  genesisTokenFromDataUri,
  verifyGenesisOwnership,
} from "@/lib/web3/genesis";

export async function prepareOwnedArtifact(address: string, tokenId: bigint) {
  const client = createPublicClient({
    chain: targetChain,
    transport: http(targetRpcUrl),
  });
  const tokens = await discoverOwnedGenesis(address);
  let token = tokens.find((candidate) => candidate.tokenId === tokenId);
  const configuredTestToken = process.env.NEXT_PUBLIC_TEST_TOKEN_ID;
  if (
    !token &&
    targetChain.testnet &&
    configuredTestToken === tokenId.toString()
  ) {
    const tokenUri = await client.readContract({
      address: GENESIS_CONTRACT,
      abi: GENESIS_ABI,
      functionName: "tokenURI",
      args: [tokenId],
    });
    token = genesisTokenFromDataUri(tokenId, tokenUri) ?? undefined;
  }
  if (!token) throw new Error("Rare Friend was not found in this wallet");
  const owned = await verifyGenesisOwnership(address, tokenId, (id) =>
    client.readContract({
      address: GENESIS_CONTRACT,
      abi: GENESIS_ABI,
      functionName: "ownerOf",
      args: [id],
    }),
  );
  if (!owned) throw new Error("Wallet no longer owns this Rare Friend");
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
    generatorVersion: "friendenza-v3",
    name: token.name,
    traits: token.traits,
    sourceMetadata,
    tonalProfile,
  });

  return { token, artifact };
}
