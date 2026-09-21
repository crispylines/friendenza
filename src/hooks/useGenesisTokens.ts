"use client";

import { useQuery } from "@tanstack/react-query";

export interface WalletGenesisToken {
  tokenId: string;
  name: string;
  imageUrl: string | null;
  traits: Record<string, string | number>;
  claimed: boolean;
}

async function loadGenesisTokens(address: string): Promise<WalletGenesisToken[]> {
  const response = await fetch(`/api/genesis/${address}`, {
    headers: { accept: "application/json" },
  });
  const payload = (await response.json()) as {
    tokens?: WalletGenesisToken[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load Rare Friends");
  }
  return payload.tokens ?? [];
}

export function useGenesisTokens(address?: string) {
  return useQuery({
    queryKey: ["genesis-tokens", address],
    queryFn: () => loadGenesisTokens(address as string),
    enabled: Boolean(address),
    staleTime: 30_000,
    retry: 1,
  });
}
