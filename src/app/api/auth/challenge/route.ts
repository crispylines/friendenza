import { NextResponse } from "next/server";
import { z } from "zod";
import { createChallenge } from "@/lib/claim/challenge";
import { targetChain } from "@/lib/web3/config";

const requestSchema = z.object({
  address: z.string(),
});

export async function POST(request: Request) {
  try {
    const { address } = requestSchema.parse(await request.json());
    const secret = process.env.CHALLENGE_SECRET;
    if (!secret) throw new Error("CHALLENGE_SECRET is not configured");
    const domain = new URL(request.url).host;
    return NextResponse.json(
      createChallenge(address, domain, secret, Date.now(), targetChain.id),
    );
  } catch (error) {
    const configurationError =
      error instanceof Error && error.message.includes("not configured");
    console.error("[wallet-challenge] Unable to issue challenge", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: configurationError ? "Claim service is not configured" : "Invalid request" },
      { status: configurationError ? 503 : 400 },
    );
  }
}
