import { NextResponse } from "next/server";
import { createPublicClient, http, type Hex } from "viem";
import { targetChain, targetRpcUrl } from "@/lib/web3/config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) {
    return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
  }

  const client = createPublicClient({
    chain: targetChain,
    transport: http(targetRpcUrl),
  });
  try {
    const receipt = await client.getTransactionReceipt({ hash: hash as Hex });
    return NextResponse.json({
      status: receipt.status,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber.toString(),
    });
  } catch {
    return NextResponse.json({ status: "pending", transactionHash: hash });
  }
}
