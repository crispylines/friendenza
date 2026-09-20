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
});
