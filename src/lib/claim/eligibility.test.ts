import { describe, expect, it, vi } from "vitest";
import { assertChallengeChain, prepareIfUnclaimed } from "./eligibility";

describe("claim eligibility", () => {
  it("rejects an already-claimed token before expensive preparation", async () => {
    const readClaimed = vi.fn(async () => true);
    const prepare = vi.fn(async () => ({ tokenUri: "ipfs://unused" }));

    await expect(prepareIfUnclaimed(43n, readClaimed, prepare)).rejects.toThrow(
      "Friendenza already claimed",
    );
    expect(readClaimed).toHaveBeenCalledWith(43n);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("prepares an unclaimed token exactly once", async () => {
    const readClaimed = vi.fn(async () => false);
    const prepare = vi.fn(async () => ({ tokenUri: "ipfs://metadata" }));

    await expect(prepareIfUnclaimed(44n, readClaimed, prepare)).resolves.toEqual({
      tokenUri: "ipfs://metadata",
    });
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("rejects a challenge issued for another chain", () => {
    expect(() => assertChallengeChain(46630, 4663)).toThrow(
      "Challenge chain mismatch",
    );
    expect(() => assertChallengeChain(4663, 4663)).not.toThrow();
  });
});
