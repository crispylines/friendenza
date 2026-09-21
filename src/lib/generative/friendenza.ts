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

function generatePixelClustersV1(input: FriendenzaInput): FriendenzaResult {
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

function generateFlowRibbonsV2(input: FriendenzaInput): FriendenzaResult {
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
  const noise = createNoise(random, 18);
  const tonalProfile = normalizeTonalProfile(input.tonalProfile);
  const backgroundChoices = tonalProfile.mean >= 0.5 ? [6, 7, 7] : [0, 0, 1];
  const backgroundIndex = backgroundChoices[random.int(0, backgroundChoices.length - 1)];
  const lightBackground = backgroundIndex >= 4;
  const orientation = traitsHash % 3;
  const laneSpacing = random.int(4, 7);
  const firstLane = orientation === 2 ? -18 : -5;
  const lastLane = orientation === 2 ? 80 : 69;
  const bandCount = Math.ceil((lastLane - firstLane) / laneSpacing);
  const groups: string[] = [];

  function transform(along: number, across: number): [number, number] {
    if (orientation === 1) return [across, along];
    if (orientation === 2) {
      return [along, across + Math.round((along - gridCells / 2) * 0.34)];
    }
    return [along, across];
  }

  for (let band = 0; band < bandCount; band += 1) {
    let center = firstLane + band * laneSpacing + random.int(-1, 1);
    let drift = 0;
    let bandWidth = random.int(2, 5);
    let toneIndex = lightBackground ? random.int(0, 4) : random.int(3, 7);
    let toneRemaining = random.int(8, 22);
    let widthRemaining = random.int(9, 20);
    let gapRemaining = 0;
    let accentRemaining = 0;
    const start = random.int(-7, 5);
    const finish = random.int(58, 72);
    const cells: string[] = [];

    for (let along = start; along <= finish; along += 1) {
      const field = noise((along + 12) / 7.5, (center + 24) / 7.5);
      drift += (field - 0.5) * (0.28 + tonalProfile.contrast * 0.32);
      drift += Math.sin((along + band * 5) / 13) * 0.025;
      drift = Math.max(-0.9, Math.min(0.9, drift * 0.82));
      center += drift;

      widthRemaining -= 1;
      if (widthRemaining <= 0) {
        bandWidth = Math.max(1, Math.min(6, bandWidth + random.int(-1, 1)));
        widthRemaining = random.int(7, 18);
      }

      toneRemaining -= 1;
      if (toneRemaining <= 0) {
        const nextTone = lightBackground ? random.int(0, 5) : random.int(2, 7);
        toneIndex = Math.abs(nextTone - backgroundIndex) < 2
          ? lightBackground
            ? Math.max(0, nextTone - 2)
            : Math.min(7, nextTone + 2)
          : nextTone;
        toneRemaining = random.int(5, 18);
      }

      if (gapRemaining > 0) {
        gapRemaining -= 1;
        continue;
      }
      if (random.next() < 0.028) {
        gapRemaining = random.int(1, 4);
        continue;
      }

      if (accentRemaining <= 0 && bandWidth >= 3 && random.next() < 0.07) {
        accentRemaining = random.int(2, 8);
      }

      const top = Math.round(center - bandWidth / 2);
      for (let offset = 0; offset < bandWidth; offset += 1) {
        const [x, y] = transform(along, top + offset);
        if (x < 0 || y < 0 || x >= gridCells || y >= gridCells) continue;
        const isAccent = accentRemaining > 0 && offset === Math.floor(bandWidth / 2);
        const accentIndex = lightBackground
          ? Math.min(7, toneIndex + 3)
          : Math.max(0, toneIndex - 3);
        const fill = FRIENDENZA_GRAYSCALE[isAccent ? accentIndex : toneIndex];
        cells.push(
          `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fill}"/>`,
        );
      }
      accentRemaining -= 1;
    }

    if (cells.length > 0) {
      groups.push(`<g data-band="${band}">${cells.join("")}</g>`);
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}" width="${canvasSize}" height="${canvasSize}" shape-rendering="crispEdges" data-composition="flow-ribbons">`,
    `<rect x="0" y="0" width="${canvasSize}" height="${canvasSize}" fill="${FRIENDENZA_GRAYSCALE[backgroundIndex]}"/>`,
    ...groups,
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

function generateFlowRibbonsV3(input: FriendenzaInput): FriendenzaResult {
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
  const tonalProfile = normalizeTonalProfile(input.tonalProfile);
  const direction = random.int(0, 7);
  const density = random.int(3, 9);
  const perspective = 0.18 + random.next() * 0.5;
  const curvature = 0.16 + random.next() * 0.58;
  const wavePeriod = random.int(8, 27);
  const waveStrength = random.next() * 0.07;
  const gapChance = 0.006 + random.next() * 0.034;
  const noiseScale = 5.5 + random.next() * 7;
  const noise = createNoise(random, random.int(14, 28));
  const backgroundSets = tonalProfile.mean >= 0.5
    ? [[7, 7, 6], [0, 1, 7]]
    : [[0, 0, 1], [7, 6, 0]];
  const backgroundSet = backgroundSets[random.int(0, backgroundSets.length - 1)];
  const backgroundIndex = backgroundSet[random.int(0, backgroundSet.length - 1)];
  const lightBackground = backgroundIndex >= 4;
  const diagonal = direction >= 4;
  const firstLane = diagonal ? -26 : -9;
  const lastLane = diagonal ? 90 : 75;
  const bandCount = Math.ceil((lastLane - firstLane) / density);
  const groups: string[] = [];

  function transform(along: number, across: number): [number, number] {
    const offset = Math.round((along - gridCells / 2) * perspective);
    switch (direction) {
      case 1:
        return [gridCells - 1 - along, across];
      case 2:
        return [across, along];
      case 3:
        return [across, gridCells - 1 - along];
      case 4:
        return [along, across + offset];
      case 5:
        return [along, across - offset];
      case 6:
        return [across + offset, along];
      case 7:
        return [across - offset, along];
      default:
        return [along, across];
    }
  }

  for (let band = 0; band < bandCount; band += 1) {
    let center = firstLane + band * density + random.int(-2, 2);
    let drift = (random.next() - 0.5) * 0.18;
    let bandWidth = random.int(1, 7);
    let toneIndex = lightBackground ? random.int(0, 4) : random.int(3, 7);
    let toneRemaining = random.int(5, 25);
    let widthRemaining = random.int(6, 22);
    let gapRemaining = 0;
    let accentRemaining = 0;
    const crossesCanvas = random.next() < 0.68;
    const start = crossesCanvas ? random.int(-10, 2) : random.int(2, 20);
    const finish = crossesCanvas ? random.int(62, 76) : random.int(40, 63);
    const phase = random.next() * Math.PI * 2;
    const bandCurvature = curvature * (0.7 + random.next() * 0.65);
    const cells: string[] = [];

    for (let along = start; along <= finish; along += 1) {
      const field = noise(
        (along + 16 + band * 0.7) / noiseScale,
        (center + 28) / noiseScale,
      );
      const wave = Math.sin((along / wavePeriod) * Math.PI * 2 + phase) * waveStrength;
      drift += (field - 0.5) * bandCurvature + wave;
      drift = Math.max(-1.15, Math.min(1.15, drift * 0.8));
      center += drift;

      widthRemaining -= 1;
      if (widthRemaining <= 0) {
        bandWidth = Math.max(1, Math.min(8, bandWidth + random.int(-2, 2)));
        widthRemaining = random.int(5, 20);
      }

      toneRemaining -= 1;
      if (toneRemaining <= 0) {
        const nextTone = lightBackground ? random.int(0, 5) : random.int(2, 7);
        toneIndex = Math.abs(nextTone - backgroundIndex) < 2
          ? lightBackground
            ? Math.max(0, nextTone - random.int(2, 4))
            : Math.min(7, nextTone + random.int(2, 4))
          : nextTone;
        toneRemaining = random.int(4, 22);
      }

      if (gapRemaining > 0) {
        gapRemaining -= 1;
        continue;
      }
      if (random.next() < gapChance) {
        gapRemaining = random.int(1, 6);
        continue;
      }

      if (accentRemaining <= 0 && bandWidth >= 3 && random.next() < 0.09) {
        accentRemaining = random.int(1, 11);
      }

      const top = Math.round(center - bandWidth / 2);
      for (let offset = 0; offset < bandWidth; offset += 1) {
        const [x, y] = transform(along, top + offset);
        if (x < 0 || y < 0 || x >= gridCells || y >= gridCells) continue;
        const accentOffset = band % 2 === 0
          ? Math.floor(bandWidth / 2)
          : Math.max(0, bandWidth - 2);
        const isAccent = accentRemaining > 0 && offset === accentOffset;
        const accentIndex = lightBackground
          ? Math.min(7, toneIndex + random.int(2, 4))
          : Math.max(0, toneIndex - random.int(2, 4));
        const fill = FRIENDENZA_GRAYSCALE[isAccent ? accentIndex : toneIndex];
        cells.push(
          `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fill}"/>`,
        );
      }
      accentRemaining -= 1;
    }

    if (cells.length > 0) {
      groups.push(`<g data-band="${band}">${cells.join("")}</g>`);
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}" width="${canvasSize}" height="${canvasSize}" shape-rendering="crispEdges" data-composition="flow-ribbons-v3" data-direction="${direction}" data-density="${density}">`,
    `<rect x="0" y="0" width="${canvasSize}" height="${canvasSize}" fill="${FRIENDENZA_GRAYSCALE[backgroundIndex]}"/>`,
    ...groups,
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

export function generateFriendenza(input: FriendenzaInput): FriendenzaResult {
  if (input.version === "friendenza-v1") return generatePixelClustersV1(input);
  if (input.version === "friendenza-v2") return generateFlowRibbonsV2(input);
  return generateFlowRibbonsV3(input);
}
