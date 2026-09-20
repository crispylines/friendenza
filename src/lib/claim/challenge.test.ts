import { describe, expect, it } from "vitest";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhood } from "@/lib/web3/config";
import { createChallenge, verifyChallenge } from "./challenge";

const secret = "test-secret-that-is-long-enough-for-hmac";
const account = privateKeyToAccount(`0x${"22".repeat(32)}` as Hex);

describe("stateless wallet challenge", () => {
  it("round-trips an address-bound expiring message", () => {
    const issued = createChallenge(account.address, "friendenza.test", secret, 1_000_000);
    const verified = verifyChallenge(issued.token, issued.message, secret, 1_000_100);

    expect(verified.address).toBe(account.address);
    expect(verified.domain).toBe("friendenza.test");
    expect(issued.message).toContain("Sign in to Friendenza");
  });

  it("rejects tampering and expiry", () => {
    const issued = createChallenge(account.address, "friendenza.test", secret, 1_000_000);

    expect(() =>
      verifyChallenge(issued.token, `${issued.message}!`, secret, 1_000_100),
    ).toThrow("Challenge message does not match");
    expect(() =>
      verifyChallenge(issued.token, issued.message, secret, 1_700_001),
    ).toThrow("Challenge expired");
  });

  it("can be signed by the bound wallet", async () => {
    const issued = createChallenge(account.address, "friendenza.test", secret);
    const wallet = createWalletClient({
      account,
      chain: robinhood,
      transport: http(),
    });
    const signature = await wallet.signMessage({ message: issued.message });

    expect(signature).toMatch(/^0x[0-9a-f]+$/);
  });
});
