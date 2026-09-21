import { describe, expect, it } from "vitest";
import {
  FRIENDENZA_GRAYSCALE,
  generateFriendenza,
  type FriendenzaInput,
} from "./friendenza";

const baseInput: FriendenzaInput = {
  tokenId: 42n,
  seed: 0x12345678,
  version: "friendenza-v1",
  traits: {
    Background: "Cloud",
    Body: "Robot",
    Eyes: "Laser",
  },
  tonalProfile: {
    mean: 0.48,
    contrast: 0.62,
    histogram: [0.08, 0.12, 0.16, 0.2, 0.18, 0.12, 0.09, 0.05],
  },
};

const ribbonInput: FriendenzaInput = {
  ...baseInput,
  version: "friendenza-v2",
};

const diverseRibbonInput: FriendenzaInput = {
  ...baseInput,
  version: "friendenza-v3",
};

describe("generateFriendenza", () => {
  it("renders identical SVG for identical versioned inputs", () => {
    expect(generateFriendenza(baseInput)).toEqual(generateFriendenza(baseInput));
  });

  it("changes when the seed, traits, or tonal profile changes", () => {
    const original = generateFriendenza(baseInput).svg;

    expect(generateFriendenza({ ...baseInput, seed: baseInput.seed + 1 }).svg).not.toBe(original);
    expect(
      generateFriendenza({
        ...baseInput,
        traits: { ...baseInput.traits, Eyes: "Sleepy" },
      }).svg,
    ).not.toBe(original);
    expect(
      generateFriendenza({
        ...baseInput,
        tonalProfile: { ...baseInput.tonalProfile, mean: 0.8 },
      }).svg,
    ).not.toBe(original);
  });

  it("uses only the fixed grayscale ramp and a crisp pixel grid", () => {
    const result = generateFriendenza(baseInput);
    const fills = [...result.svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((match) =>
      match[1].toLowerCase(),
    );
    const palette = new Set<string>(FRIENDENZA_GRAYSCALE);
    const rects = [...result.svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)];

    expect(result.svg).toContain('shape-rendering="crispEdges"');
    expect(fills.length).toBeGreaterThan(20);
    expect(fills.every((fill) => palette.has(fill))).toBe(true);
    expect(rects.length).toBeGreaterThan(20);

    for (const [, x, y, width, height] of rects) {
      expect(Number(x) % result.cellSize).toBe(0);
      expect(Number(y) % result.cellSize).toBe(0);
      expect(Number(width) % result.cellSize).toBe(0);
      expect(Number(height) % result.cellSize).toBe(0);
    }
  });

  it("records provenance without embedding unsafe trait text in the SVG", () => {
    const result = generateFriendenza({
      ...baseInput,
      traits: { Name: `"><script>alert(1)</script>` },
    });

    expect(result.provenance.tokenId).toBe("42");
    expect(result.provenance.generatorVersion).toBe("friendenza-v1");
    expect(result.svg).not.toContain("<script");
    expect(result.svg).not.toContain("alert(1)");
  });

  it("preserves v1 while v2 renders long coherent flow ribbons", () => {
    const legacy = generateFriendenza(baseInput);
    const ribbons = generateFriendenza(ribbonInput);
    const bands = [...ribbons.svg.matchAll(/<g data-band="\d+">(.+?)<\/g>/g)];
    const longestBand = Math.max(
      ...bands.map(([, content]) => [...content.matchAll(/<rect /g)].length),
    );

    expect(legacy.svg).not.toContain('data-composition="flow-ribbons"');
    expect(ribbons.svg).toContain('data-composition="flow-ribbons"');
    expect(ribbons.svg).not.toBe(legacy.svg);
    expect(bands.length).toBeGreaterThanOrEqual(8);
    expect(longestBand).toBeGreaterThan(80);
    expect(ribbons.provenance.generatorVersion).toBe("friendenza-v2");
  });

  it("keeps v2 ribbons deterministic, grayscale, and grid-aligned", () => {
    const first = generateFriendenza(ribbonInput);
    const second = generateFriendenza(ribbonInput);
    const palette = new Set<string>(FRIENDENZA_GRAYSCALE);
    const fills = [...first.svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map(
      (match) => match[1].toLowerCase(),
    );
    const rects = [
      ...first.svg.matchAll(
        /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g,
      ),
    ];

    expect(first).toEqual(second);
    expect(fills.every((fill) => palette.has(fill))).toBe(true);
    expect(rects.length).toBeGreaterThan(500);
    for (const [, x, y, width, height] of rects) {
      expect(Number(x) % first.cellSize).toBe(0);
      expect(Number(y) % first.cellSize).toBe(0);
      expect(Number(width) % first.cellSize).toBe(0);
      expect(Number(height) % first.cellSize).toBe(0);
    }
  });

  it("gives v3 tokens varied directions, density, and composition", () => {
    const samples = Array.from({ length: 24 }, (_, index) =>
      generateFriendenza({
        ...diverseRibbonInput,
        tokenId: BigInt(index + 1),
        seed: diverseRibbonInput.seed + index * 7919,
      }),
    );
    const directions = samples.map(
      ({ svg }) => svg.match(/data-direction="(\d+)"/)?.[1],
    );
    const densities = samples.map(
      ({ svg }) => svg.match(/data-density="(\d+)"/)?.[1],
    );

    expect(samples[0].svg).toContain('data-composition="flow-ribbons-v3"');
    expect(new Set(samples.map(({ svg }) => svg)).size).toBe(samples.length);
    expect(new Set(directions).size).toBeGreaterThanOrEqual(6);
    expect(new Set(densities).size).toBeGreaterThanOrEqual(4);
    expect(samples.every(({ provenance }) => provenance.generatorVersion === "friendenza-v3"))
      .toBe(true);
  });
});
