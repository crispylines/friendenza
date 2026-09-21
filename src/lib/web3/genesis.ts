import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import { blockscoutApiBase, robinhood, targetChain } from "./config";

export const GENESIS_CONTRACT = getAddress(
  process.env.NEXT_PUBLIC_GENESIS_CONTRACT ??
    (targetChain.id === robinhood.id
      ? "0x116EaA62241751E0c98dA43d458600c6C17cD361"
      : zeroAddress),
);

export const GENESIS_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export interface GenesisToken {
  tokenId: bigint;
  name: string;
  imageUrl: string | null;
  traits: Record<string, string | number>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type OwnerReader = (tokenId: bigint) => Promise<string>;
const MAX_METADATA_BYTES = 1024 * 1024;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (
    value.startsWith("ipfs://") ||
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("data:image/")
  ) {
    return value;
  }
  return null;
}

function normalizeTraits(value: unknown): Record<string, string | number> {
  if (!Array.isArray(value)) return {};

  return Object.fromEntries(
    value.flatMap((attribute) => {
      const record = asRecord(attribute);
      const key = record?.trait_type;
      const traitValue = record?.value;
      if (
        typeof key !== "string" ||
        (typeof traitValue !== "string" && typeof traitValue !== "number")
      ) {
        return [];
      }
      return [[key.slice(0, 80), typeof traitValue === "string" ? traitValue.slice(0, 160) : traitValue]];
    }),
  );
}

function tokenFromMetadata(tokenId: bigint, value: unknown): GenesisToken | null {
  const metadata = asRecord(value);
  if (!metadata) return null;
  const metadataName = metadata.name;
  return {
    tokenId,
    name:
      typeof metadataName === "string" && metadataName.trim()
        ? metadataName.slice(0, 160)
        : `Rare Friend #${tokenId}`,
    imageUrl: safeImageUrl(metadata.image),
    traits: normalizeTraits(metadata.attributes),
  };
}

function normalizeItem(value: unknown): GenesisToken | null {
  const item = asRecord(value);
  const token = asRecord(item?.token);
  const metadata = asRecord(item?.metadata);
  const tokenAddress = token?.address_hash;

  if (
    typeof tokenAddress !== "string" ||
    tokenAddress.toLowerCase() !== GENESIS_CONTRACT.toLowerCase() ||
    typeof item?.id !== "string" ||
    !/^\d+$/.test(item.id)
  ) {
    return null;
  }

  const tokenId = BigInt(item.id);
  const metadataName = metadata?.name;
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.slice(0, 160)
      : `Rare Friend #${tokenId}`;

  return {
    tokenId,
    name,
    imageUrl: safeImageUrl(item.image_url) ?? safeImageUrl(metadata?.image),
    traits: normalizeTraits(metadata?.attributes),
  };
}

export function genesisTokenFromDataUri(
  tokenId: bigint,
  tokenUri: string,
): GenesisToken | null {
  const separator = tokenUri.indexOf(",");
  if (!tokenUri.startsWith("data:application/json") || separator === -1) return null;

  try {
    const header = tokenUri.slice(0, separator);
    const encoded = tokenUri.slice(separator + 1);
    const json = header.includes(";base64")
      ? Buffer.from(encoded, "base64").toString("utf8")
      : decodeURIComponent(encoded);
    return tokenFromMetadata(tokenId, JSON.parse(json));
  } catch {
    return null;
  }
}

function isPrivateMetadataHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.")
  ) {
    return true;
  }
  const match = normalized.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export async function fetchGenesisTokenFromUri(
  tokenId: bigint,
  tokenUri: string,
  fetcher: FetchLike = fetch,
  ipfsGateway = process.env.IPFS_GATEWAY_URL ?? "https://ipfs.io/ipfs/",
): Promise<GenesisToken | null> {
  if (tokenUri.startsWith("data:application/json")) {
    return genesisTokenFromDataUri(tokenId, tokenUri);
  }

  let resolved = tokenUri;
  if (tokenUri.startsWith("ipfs://")) {
    const gateway = new URL(ipfsGateway);
    if (gateway.protocol !== "https:" || isPrivateMetadataHostname(gateway.hostname)) {
      throw new Error("Unsafe metadata URL");
    }
    if (!gateway.pathname.endsWith("/")) gateway.pathname += "/";
    resolved = new URL(tokenUri.slice("ipfs://".length), gateway).toString();
  }

  const parsed = new URL(resolved);
  if (parsed.protocol !== "https:" || isPrivateMetadataHostname(parsed.hostname)) {
    throw new Error("Unsafe metadata URL");
  }
  const response = await fetcher(parsed.toString(), {
    headers: { accept: "application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Metadata request failed (${response.status})`);
  if (response.url) {
    const finalUrl = new URL(response.url);
    if (
      finalUrl.protocol !== "https:" ||
      isPrivateMetadataHostname(finalUrl.hostname)
    ) {
      throw new Error("Unsafe metadata redirect");
    }
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_METADATA_BYTES) throw new Error("Metadata is too large");
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_METADATA_BYTES) throw new Error("Metadata is too large");
  return tokenFromMetadata(tokenId, JSON.parse(text));
}

export async function discoverOwnedGenesis(
  walletAddress: string,
  fetcher: FetchLike = fetch,
): Promise<GenesisToken[]> {
  if (!isAddress(walletAddress)) {
    throw new Error("Invalid wallet address");
  }

  const address = getAddress(walletAddress);
  let url = `${blockscoutApiBase}/addresses/${address}/nft?type=ERC-721`;
  const tokens = new Map<string, GenesisToken>();

  for (let page = 0; page < 20 && url; page += 1) {
    const response = await fetcher(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    } as RequestInit);
    if (!response.ok) {
      throw new Error(`Blockscout request failed (${response.status})`);
    }

    const payload = asRecord(await response.json());
    const items = Array.isArray(payload?.items) ? payload.items : [];
    for (const item of items) {
      const token = normalizeItem(item);
      if (token) tokens.set(token.tokenId.toString(), token);
    }

    const next = asRecord(payload?.next_page_params);
    if (!next || Object.keys(next).length === 0) break;
    const params = new URLSearchParams({ type: "ERC-721" });
    for (const [key, value] of Object.entries(next)) {
      if (typeof value === "string" || typeof value === "number") {
        params.set(key, String(value));
      }
    }
    url = `${blockscoutApiBase}/addresses/${address}/nft?${params}`;
  }

  return [...tokens.values()].sort((left, right) =>
    left.tokenId < right.tokenId ? -1 : left.tokenId > right.tokenId ? 1 : 0,
  );
}

export async function verifyGenesisOwnership(
  walletAddress: string,
  tokenId: bigint,
  readOwner: OwnerReader,
): Promise<boolean> {
  if (!isAddress(walletAddress)) return false;

  try {
    const currentOwner = await readOwner(tokenId);
    return isAddress(currentOwner) && getAddress(currentOwner) === getAddress(walletAddress);
  } catch {
    return false;
  }
}

export function serializeGenesisToken(token: GenesisToken) {
  return { ...token, tokenId: token.tokenId.toString() };
}

export type GenesisAddress = Address;
