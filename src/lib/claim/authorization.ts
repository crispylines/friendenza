import {
  encodePacked,
  getAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { stableJson, type FriendenzaArtifact } from "@/lib/art/pipeline";

export const CLAIM_TYPES = {
  Claim: [
    { name: "recipient", type: "address" },
    { name: "sourceTokenId", type: "uint256" },
    { name: "metadataDigest", type: "bytes32" },
    { name: "tokenUriHash", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

interface AuthorizationDependencies {
  chainId: number;
  claimContract: string;
  privateKey: Hex;
  pinSvg: (name: string, svg: string) => Promise<string>;
  pinJson: (name: string, value: unknown) => Promise<string>;
  nowSeconds?: number;
}

interface AuthorizationInput {
  recipient: string;
  artifact: FriendenzaArtifact;
}

export async function prepareClaimAuthorization(
  input: AuthorizationInput,
  dependencies: AuthorizationDependencies,
) {
  const recipient = getAddress(input.recipient);
  const claimContract = getAddress(dependencies.claimContract);
  const tokenId = BigInt(input.artifact.provenance.tokenId);
  const idempotencyKey = keccak256(
    encodePacked(
      ["address", "uint256", "bytes32", "bytes32"],
      [
        recipient,
        tokenId,
        input.artifact.sourceMetadataDigest,
        input.artifact.svgDigest,
      ],
    ),
  );
  const svgCid = await dependencies.pinSvg(
    `friendenza-${tokenId}-${input.artifact.svgDigest.slice(2, 10)}.svg`,
    input.artifact.svg,
  );
  const finalMetadata = {
    ...input.artifact.metadata,
    image: `ipfs://${svgCid}`,
  };
  const metadataDigest = keccak256(stringToHex(stableJson(finalMetadata)));
  const metadataCid = await dependencies.pinJson(
    `friendenza-${tokenId}-${metadataDigest.slice(2, 10)}.json`,
    finalMetadata,
  );
  const tokenUri = `ipfs://${metadataCid}`;
  const tokenUriHash = keccak256(stringToHex(tokenUri));
  const deadline = BigInt((dependencies.nowSeconds ?? Math.floor(Date.now() / 1000)) + 15 * 60);
  const domain = {
    name: "Friendenza",
    version: "1",
    chainId: dependencies.chainId,
    verifyingContract: claimContract as Address,
  } as const;
  const message = {
    recipient,
    sourceTokenId: tokenId,
    metadataDigest,
    tokenUriHash,
    deadline,
  } as const;
  const account = privateKeyToAccount(dependencies.privateKey);
  const signature = await account.signTypedData({
    domain,
    types: CLAIM_TYPES,
    primaryType: "Claim",
    message,
  });

  return {
    idempotencyKey,
    tokenUri,
    metadataDigest,
    deadline: Number(deadline),
    signature,
    imageUri: `ipfs://${svgCid}`,
    typedData: {
      domain,
      types: CLAIM_TYPES,
      primaryType: "Claim" as const,
      message,
    },
  };
}
