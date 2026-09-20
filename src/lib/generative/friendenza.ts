export const FRIENDENZA_GRAYSCALE = [
  "#000000",
  "#202020",
  "#454545",
  "#707070",
  "#9b9b9b",
  "#c5c5c5",
  "#e1e1e1",
  "#ffffff",
] as const;

export interface TonalProfile {
  mean: number;
  contrast: number;
  histogram: number[];
}

export interface FriendenzaInput {
  tokenId: bigint;
  seed: number;
  version: string;
  traits: Record<string, string | number>;
  tonalProfile: TonalProfile;
  size?: number;
}

export interface FriendenzaResult {
  svg: string;
  width: number;
  height: number;
  cellSize: number;
  provenance: {
    tokenId: string;
    generatorVersion: string;
    seed: number;
    traitsDigest: string;
    tonalProfile: TonalProfile;
  };
}

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let value = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stableTraits(traits: FriendenzaInput["traits"]): string {
  return Object.entries(traits)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join("|");
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function createNoise(random: SeededRandom, gridSize: number) {
  const grid = Array.from({ length: gridSize + 1 }, () =>
    Array.from({ length: gridSize + 1 }, () => random.next()),
  );

  return (x: number, y: number): number => {
    const wrappedX = ((x % gridSize) + gridSize) % gridSize;
    const wrappedY = ((y % gridSize) + gridSize) % gridSize;
    const ix = Math.floor(wrappedX);
    const iy = Math.floor(wrappedY);
    const fx = wrappedX - ix;
    const fy = wrappedY - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = grid[ix][iy] * (1 - sx) + grid[ix + 1][iy] * sx;
    const bottom = grid[ix][iy + 1] * (1 - sx) + grid[ix + 1][iy + 1] * sx;
    return top * (1 - sy) + bottom * sy;
  };
}

function normalizeTonalProfile(profile: TonalProfile): TonalProfile {
  const histogram = Array.from({ length: 8 }, (_, index) =>
    clamp(Number.isFinite(profile.histogram[index]) ? profile.histogram[index] : 0),
  );
  const total = histogram.reduce((sum, value) => sum + value, 0) || 1;

  return {
    mean: clamp(profile.mean),
    contrast: clamp(profile.contrast),
    histogram: histogram.map((value) => Number((value / total).toFixed(6))),
  };
}

function chooseTone(
  random: SeededRandom,
  fieldValue: number,
  profile: TonalProfile,
): (typeof FRIENDENZA_GRAYSCALE)[number] {
  const centered = (fieldValue - 0.5) * (0.55 + profile.contrast);
  const jitter = (random.next() - 0.5) * 0.2;
  const target = clamp(profile.mean + centered + jitter);
  const weightedTarget = clamp(target * 0.75 + random.next() * 0.25);
  const index = Math.min(7, Math.floor(weightedTarget * 8));
  return FRIENDENZA_GRAYSCALE[index];
}

export function generateFriendenza(input: FriendenzaInput): FriendenzaResult {
  const size = Math.max(128, Math.min(1024, Math.floor(input.size ?? 512)));
  const gridCells = 64;
  const cellSize = Math.max(2, Math.floor(size / gridCells));
  const canvasSize = cellSize * gridCells;
  const traitsText = stableTraits(input.traits);
  const traitsHash = hashString(traitsText);
  const versionHash = hashString(input.version);
  const tokenHash = Number(BigInt.asUintN(32, input.tokenId));
  const mixedSeed = (input.seed ^ traitsHash ^ versionHash ^ tokenHash) >>> 0;
  const random = new SeededRandom(mixedSeed);
  const noise = createNoise(random, 32);
  const tonalProfile = normalizeTonalProfile(input.tonalProfile);
  const backgroundIndex = Math.min(7, Math.max(0, Math.round(tonalProfile.mean * 7)));
  const rectangles: string[] = [
    `<rect x="0" y="0" width="${canvasSize}" height="${canvasSize}" fill="${FRIENDENZA_GRAYSCALE[backgroundIndex]}"/>`,
  ];
  const streamCount = 72 + (traitsHash % 33);

  for (let stream = 0; stream < streamCount; stream += 1) {
    let gridX = random.int(0, gridCells - 1);
    let gridY = random.int(0, gridCells - 1);
    const steps = random.int(5, 22);
    const bandWidth = random.int(1, 3);

    for (let step = 0; step < steps; step += 1) {
      const fieldValue = noise(gridX / 2.5, gridY / 2.5);
      const angle = fieldValue * Math.PI * 4 + stream * 0.17;
      const horizontal = Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle));
      const widthCells = horizontal ? random.int(1, 4) : bandWidth;
      const heightCells = horizontal ? bandWidth : random.int(1, 4);
      const boundedWidth = Math.min(widthCells, gridCells - gridX);
      const boundedHeight = Math.min(heightCells, gridCells - gridY);
      const fill = chooseTone(random, fieldValue, tonalProfile);

      rectangles.push(
        `<rect x="${gridX * cellSize}" y="${gridY * cellSize}" width="${boundedWidth * cellSize}" height="${boundedHeight * cellSize}" fill="${fill}"/>`,
      );

      const deltaX = Math.round(Math.cos(angle));
      const deltaY = Math.round(Math.sin(angle));
      gridX = (gridX + deltaX + gridCells) % gridCells;
      gridY = (gridY + deltaY + gridCells) % gridCells;
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}" width="${canvasSize}" height="${canvasSize}" shape-rendering="crispEdges">`,
    ...rectangles,
    "</svg>",
  ].join("");

  return {
    svg,
    width: canvasSize,
    height: canvasSize,
    cellSize,
    provenance: {
      tokenId: input.tokenId.toString(),
      generatorVersion: input.version,
      seed: input.seed >>> 0,
      traitsDigest: `fnv1a32:${traitsHash.toString(16).padStart(8, "0")}`,
      tonalProfile,
    },
  };
}
