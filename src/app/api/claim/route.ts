import { NextResponse } from "next/server";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  verifyMessage,
  type Hex,
} from "viem";
import { z } from "zod";
import { prepareOwnedArtifact } from "@/lib/art/owned-artifact";
import { prepareClaimAuthorization } from "@/lib/claim/authorization";
import { verifyChallenge } from "@/lib/claim/challenge";
import {
  assertChallengeChain,
  prepareIfUnclaimed,
} from "@/lib/claim/eligibility";
import { createPinataClient } from "@/lib/claim/pinata";
import { targetChain, targetRpcUrl } from "@/lib/web3/config";
import { FRIENDENZA_ABI } from "@/lib/web3/friendenza";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  address: z.string(),
  tokenId: z.string().regex(/^\d+$/),
  message: z.string().max(2_000),
  signature: z.string().regex(/^0x[0-9a-f]+$/i),
  challengeToken: z.string().max(4_000),
});

const inFlightClaims = new Map<string, Promise<Awaited<ReturnType<typeof createClaim>>>>();

function requiredEnvironment() {
  const values = {
    challengeSecret: process.env.CHALLENGE_SECRET,
    pinataJwt: process.env.PINATA_JWT,
    privateKey: process.env.AUTHORIZATION_PRIVATE_KEY,
    claimContract: process.env.NEXT_PUBLIC_FRIENDENZA_CONTRACT,
  };
  if (
    !values.challengeSecret ||
    !values.pinataJwt ||
    !values.privateKey ||
    !values.claimContract ||
    !/^0x[0-9a-f]{64}$/i.test(values.privateKey) ||
    !isAddress(values.claimContract)
  ) {
    throw new Error("Claim service environment is not configured");
  }
  return values as {
    challengeSecret: string;
    pinataJwt: string;
    privateKey: Hex;
    claimContract: string;
  };
}

async function createClaim(
  address: string,
  tokenId: bigint,
  environment: ReturnType<typeof requiredEnvironment>,
) {
  const client = createPublicClient({
    chain: targetChain,
    transport: http(targetRpcUrl),
  });
  return prepareIfUnclaimed(
    tokenId,
    (sourceTokenId) =>
      client.readContract({
        address: getAddress(environment.claimContract),
        abi: FRIENDENZA_ABI,
        functionName: "claimed",
        args: [sourceTokenId],
      }),
    async () => {
      const { artifact } = await prepareOwnedArtifact(address, tokenId);
      const pinata = createPinataClient(environment.pinataJwt);
      const authorization = await prepareClaimAuthorization(
        { recipient: address, artifact },
        {
          chainId: targetChain.id,
          claimContract: environment.claimContract,
          privateKey: environment.privateKey,
          pinSvg: pinata.pinSvg,
          pinJson: pinata.pinJson,
        },
      );

      return {
        contract: getAddress(environment.claimContract),
        chainId: targetChain.id,
        tokenId: tokenId.toString(),
        tokenUri: authorization.tokenUri,
        metadataDigest: authorization.metadataDigest,
        deadline: authorization.deadline,
        signature: authorization.signature,
        imageUri: authorization.imageUri,
        idempotencyKey: authorization.idempotencyKey,
      };
    },
  );
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const environment = requiredEnvironment();
    const challenge = verifyChallenge(
      body.challengeToken,
      body.message,
      environment.challengeSecret,
    );
    assertChallengeChain(challenge.chainId, targetChain.id);
    if (getAddress(body.address) !== challenge.address) {
      return NextResponse.json({ error: "Challenge address mismatch" }, { status: 401 });
    }
    const signatureValid = await verifyMessage({
      address: challenge.address,
      message: body.message,
      signature: body.signature as Hex,
    });
    if (!signatureValid) {
      return NextResponse.json({ error: "Invalid wallet signature" }, { status: 401 });
    }

    const tokenId = BigInt(body.tokenId);
    const requestKey = `${challenge.address.toLowerCase()}:${tokenId}`;
    let pending = inFlightClaims.get(requestKey);
    if (!pending) {
      pending = createClaim(challenge.address, tokenId, environment);
      inFlightClaims.set(requestKey, pending);
    }
    try {
      return NextResponse.json(await pending);
    } finally {
      inFlightClaims.delete(requestKey);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const configurationError = message.includes("not configured");
    const alreadyClaimed = message.includes("already claimed");
    const authenticationError = message.includes("Challenge chain mismatch");
    const ownershipError =
      message.includes("not found") ||
      message.includes("no longer owns") ||
      message.includes("unavailable");
    console.error("[claim-service] Claim preparation failed", { message });
    return NextResponse.json(
      {
        error: configurationError
          ? "Claim service is not configured"
          : alreadyClaimed
            ? "This Rare Friend already has a Friendenza"
            : authenticationError
              ? "Wallet challenge was issued for another network"
          : ownershipError
            ? message
            : "Unable to prepare this claim. Please retry.",
      },
      {
        status: configurationError
          ? 503
          : alreadyClaimed
            ? 409
            : authenticationError
              ? 401
              : ownershipError
                ? 403
                : 400,
      },
    );
  }
}
