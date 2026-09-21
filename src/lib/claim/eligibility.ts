type ClaimedReader = (tokenId: bigint) => Promise<boolean>;

export function assertChallengeChain(actualChainId: number, expectedChainId: number) {
  if (actualChainId !== expectedChainId) {
    throw new Error("Challenge chain mismatch");
  }
}

export async function prepareIfUnclaimed<T>(
  tokenId: bigint,
  readClaimed: ClaimedReader,
  prepare: () => Promise<T>,
): Promise<T> {
  if (await readClaimed(tokenId)) {
    throw new Error("Friendenza already claimed");
  }
  return prepare();
}
