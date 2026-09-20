import { getAddress, isAddress, zeroAddress } from "viem";

export const FRIENDENZA_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sourceTokenId", type: "uint256" },
      { name: "tokenUri", type: "string" },
      { name: "metadataDigest", type: "bytes32" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [{ name: "sourceTokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const configuredAddress = process.env.NEXT_PUBLIC_FRIENDENZA_CONTRACT;

export const FRIENDENZA_CONTRACT =
  configuredAddress && isAddress(configuredAddress)
    ? getAddress(configuredAddress)
    : zeroAddress;

export const CLAIMS_CONFIGURED = FRIENDENZA_CONTRACT !== zeroAddress;
