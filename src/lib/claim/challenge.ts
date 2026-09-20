import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, isAddress, type Address } from "viem";

interface ChallengePayload {
  address: Address;
  domain: string;
  nonce: string;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
}

const CHALLENGE_LIFETIME_MS = 10 * 60 * 1000;

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function signPayload(encodedPayload: string, secret: string): string {
  return encode(createHmac("sha256", secret).update(encodedPayload).digest());
}

function buildMessage(payload: ChallengePayload): string {
  return [
    `${payload.domain} wants you to sign in with your Ethereum account:`,
    payload.address,
    "",
    "Sign in to Friendenza to generate a claim for your Rare Friend.",
    "",
    `URI: https://${payload.domain}`,
    "Version: 1",
    `Chain ID: ${payload.chainId}`,
    `Nonce: ${payload.nonce}`,
    `Issued At: ${new Date(payload.issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(payload.expiresAt).toISOString()}`,
  ].join("\n");
}

export function createChallenge(
  walletAddress: string,
  domain: string,
  secret: string,
  now = Date.now(),
  chainId = 4663,
): { token: string; message: string; expiresAt: string } {
  if (!isAddress(walletAddress)) throw new Error("Invalid wallet address");
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(domain)) throw new Error("Invalid domain");
  if (secret.length < 24) throw new Error("Challenge secret is too short");

  const payload: ChallengePayload = {
    address: getAddress(walletAddress),
    domain,
    nonce: randomBytes(12).toString("hex"),
    chainId,
    issuedAt: now,
    expiresAt: now + CHALLENGE_LIFETIME_MS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return {
    token: `${encodedPayload}.${signature}`,
    message: buildMessage(payload),
    expiresAt: new Date(payload.expiresAt).toISOString(),
  };
}

export function verifyChallenge(
  token: string,
  message: string,
  secret: string,
  now = Date.now(),
): ChallengePayload {
  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) throw new Error("Invalid challenge token");
  const expectedSignature = signPayload(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Invalid challenge token");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as
    ChallengePayload;
  if (!isAddress(payload.address) || payload.expiresAt < now) {
    throw new Error(payload.expiresAt < now ? "Challenge expired" : "Invalid challenge address");
  }
  if (message !== buildMessage(payload)) throw new Error("Challenge message does not match");
  return { ...payload, address: getAddress(payload.address) };
}
