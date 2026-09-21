import { generateFriendenza } from "./friendenza";

export const friendenzaDemoSvg = generateFriendenza({
  tokenId: BigInt(1024),
  seed: 0xf13e4d2a,
  version: "friendenza-v4",
  traits: { Mood: "Rare", Form: "Pixel" },
  tonalProfile: {
    mean: 0.54,
    contrast: 0.76,
    histogram: [0.12, 0.09, 0.1, 0.14, 0.18, 0.15, 0.12, 0.1],
  },
}).svg;
