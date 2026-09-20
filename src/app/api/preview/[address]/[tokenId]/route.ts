import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { prepareOwnedArtifact } from "@/lib/art/owned-artifact";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string; tokenId: string }> },
) {
  const { address, tokenId: rawTokenId } = await params;
  if (!isAddress(address) || !/^\d+$/.test(rawTokenId)) {
    return NextResponse.json({ error: "Invalid preview request" }, { status: 400 });
  }

  try {
    const { token, artifact } = await prepareOwnedArtifact(address, BigInt(rawTokenId));
    return NextResponse.json({
      token: {
        tokenId: token.tokenId.toString(),
        name: token.name,
        traits: token.traits,
      },
      svg: artifact.svg,
      svgDigest: artifact.svgDigest,
      sourceMetadataDigest: artifact.sourceMetadataDigest,
      generatorVersion: artifact.provenance.generatorVersion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[friendenza-preview] Preview failed", { address, rawTokenId, message });
    return NextResponse.json(
      { error: "Unable to render this Friendenza preview. Please retry." },
      { status: 502 },
    );
  }
}
