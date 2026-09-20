import sharp from "sharp";
import {
  encodePacked,
  getAddress,
  isAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import {
  generateFriendenza,
  type FriendenzaResult,
  type TonalProfile,
} from "@/lib/generative/friendenza";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface SeedInput {
  chainId: number;
  contract: string;
  tokenId: bigint;
  generatorVersion: string;
  metadata: unknown;
}

export interface ArtifactInput {
  chainId: number;
  contract: string;
  tokenId: bigint;
  generatorVersion: string;
  name: string;
  traits: Record<string, string | number>;
  sourceMetadata: unknown;
  tonalProfile: TonalProfile;
}

export interface FriendenzaArtifact extends FriendenzaResult {
  seedHex: Hex;
  sourceMetadataDigest: Hex;
  svgDigest: Hex;
  metadataDigest: Hex;
  metadata: {
    name: string;
    description: string;
    image: string;
    external_url: string;
    attributes: Array<{ trait_type: string; value: string | number }>;
    properties: {
      source_chain_id: number;
      source_contract: Address;
      source_token_id: string;
      generator_version: string;
      seed: Hex;
      source_metadata_digest: Hex;
      svg_digest: Hex;
    };
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return String(value);
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function deriveCanonicalSeed(input: SeedInput): {
  seed: number;
  seedHex: Hex;
  metadataDigest: Hex;
} {
  if (!isAddress(input.contract)) throw new Error("Invalid source contract");
  const metadataDigest = keccak256(stringToHex(stableJson(input.metadata)));
  const seedHex = keccak256(
    encodePacked(
      ["uint256", "address", "uint256", "bytes32", "string"],
      [
        BigInt(input.chainId),
        getAddress(input.contract),
        input.tokenId,
        metadataDigest,
        input.generatorVersion,
      ],
    ),
  );

  return {
    seed: Number.parseInt(seedHex.slice(2, 10), 16) >>> 0,
    seedHex,
    metadataDigest,
  };
}

function isPrivateHostname(hostname: string): boolean {
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

function decodeDataImage(url: string): Buffer {
  const match = url.match(
    /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,([a-z0-9+/=\s]+)$/i,
  );
  if (!match) throw new Error("Unsupported image data URL");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Source image is too large");
  if (
    match[1].toLowerCase() === "svg+xml" &&
    /<script|(?:xlink:)?href\s*=/i.test(buffer.toString("utf8"))
  ) {
    throw new Error("Source SVG contains active or external content");
  }
  return buffer;
}

async function loadImageBytes(
  sourceUrl: string,
  fetcher: typeof fetch,
): Promise<Buffer> {
  if (sourceUrl.startsWith("data:image/")) return decodeDataImage(sourceUrl);
  const resolved = sourceUrl.startsWith("ipfs://")
    ? `https://ipfs.io/ipfs/${sourceUrl.slice("ipfs://".length)}`
    : sourceUrl;
  const parsed = new URL(resolved);
  if (!["https:", "http:"].includes(parsed.protocol) || isPrivateHostname(parsed.hostname)) {
    throw new Error("Unsafe source image URL");
  }

  const response = await fetcher(parsed, {
    headers: { accept: "image/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Source image request failed (${response.status})`);
  if (response.url) {
    const finalUrl = new URL(response.url);
    if (isPrivateHostname(finalUrl.hostname)) throw new Error("Unsafe image redirect");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES) throw new Error("Source image is too large");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Source image is too large");
  return buffer;
}

export async function extractTonalProfile(
  sourceUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<TonalProfile> {
  const buffer = await loadImageBytes(sourceUrl, fetcher);
  const pixels = await sharp(buffer, { limitInputPixels: 16_777_216 })
    .flatten({ background: "#ffffff" })
    .greyscale()
    .resize(64, 64, { fit: "fill", kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer();
  const values = [...pixels];
  const meanByte = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - meanByte) ** 2, 0) / values.length;
  const histogram = Array.from({ length: 8 }, () => 0);
  for (const value of values) histogram[Math.min(7, Math.floor(value / 32))] += 1;

  return {
    mean: Number((meanByte / 255).toFixed(6)),
    contrast: Number((Math.min(1, Math.sqrt(variance) / 127.5)).toFixed(6)),
    histogram: histogram.map((count) => Number((count / values.length).toFixed(6))),
  };
}

export function buildFriendenzaArtifact(input: ArtifactInput): FriendenzaArtifact {
  const sourceContract = getAddress(input.contract);
  const { seed, seedHex, metadataDigest: sourceMetadataDigest } = deriveCanonicalSeed({
    chainId: input.chainId,
    contract: sourceContract,
    tokenId: input.tokenId,
    generatorVersion: input.generatorVersion,
    metadata: input.sourceMetadata,
  });
  const generated = generateFriendenza({
    tokenId: input.tokenId,
    seed,
    version: input.generatorVersion,
    traits: input.traits,
    tonalProfile: input.tonalProfile,
  });
  const svgDigest = keccak256(stringToHex(generated.svg));
  const metadata = {
    name: `Friendenza #${input.tokenId}`,
    description: `Deterministic grayscale pixel art generated for ${input.name}.`,
    image: `friendenza:${svgDigest}`,
    external_url: `https://friendenza.xyz/friend/${input.tokenId}`,
    attributes: [
      { trait_type: "Source Rare Friend", value: input.tokenId.toString() },
      { trait_type: "Generator", value: input.generatorVersion },
      { trait_type: "Style", value: "Grayscale pixel flow field" },
      ...Object.entries(input.traits)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([trait_type, value]) => ({ trait_type, value })),
    ],
    properties: {
      source_chain_id: input.chainId,
      source_contract: sourceContract,
      source_token_id: input.tokenId.toString(),
      generator_version: input.generatorVersion,
      seed: seedHex,
      source_metadata_digest: sourceMetadataDigest,
      svg_digest: svgDigest,
    },
  };
  const metadataDigest = keccak256(stringToHex(stableJson(metadata)));

  return {
    ...generated,
    seedHex,
    sourceMetadataDigest,
    svgDigest,
    metadataDigest,
    metadata,
  };
}
