import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FriendenzaApp } from "./FriendenzaApp";
import { targetChain } from "@/lib/web3/config";

const { useAccount, useGenesisTokens, useQuery } = vi.hoisted(() => ({
  useAccount: vi.fn(),
  useGenesisTokens: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount,
    useConnect: () => ({
      connectors: [{ id: "injected" }],
      connect: vi.fn(),
      error: null,
    }),
    useDisconnect: () => ({ disconnect: vi.fn() }),
    useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
    usePublicClient: () => undefined,
    useSignMessage: () => ({ signMessageAsync: vi.fn() }),
    useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery,
}));

vi.mock("@/hooks/useGenesisTokens", () => ({
  useGenesisTokens,
}));

describe("FriendenzaApp", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAccount.mockReturnValue({
      address: undefined,
      chainId: undefined,
      isConnected: false,
      isConnecting: false,
    });
    useGenesisTokens.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    useQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
    });
  });

  it("presents the holder flow and connect action accessibly", () => {
    render(<FriendenzaApp />);

    expect(
      screen.getByRole("heading", { name: /make your friend flow/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /connect to begin/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /connect wallet/i })).not.toHaveLength(0);
    expect(screen.getByText(/authorized Rare Friends community project/i)).toBeInTheDocument();
  });

  it("waits for an explicit generate action and shows generation progress", () => {
    useAccount.mockReturnValue({
      address: "0x35f733b22A851307aE10D6Ba4689510e6Febdc4f",
      chainId: targetChain.id,
      isConnected: true,
      isConnecting: false,
    });
    useGenesisTokens.mockReturnValue({
      data: [
        {
          tokenId: "42",
          name: "Test Rare Friend #42",
          imageUrl: "data:image/svg+xml,<svg/>",
          traits: { Eyes: "Pixel" },
          claimed: false,
        },
      ],
      isLoading: false,
      isError: false,
    });
    useQuery.mockImplementation((options: { enabled: boolean }) => ({
      data: undefined,
      isLoading: options.enabled,
      isFetching: options.enabled,
      error: null,
    }));

    render(<FriendenzaApp />);

    expect(useQuery.mock.lastCall?.[0].enabled).toBe(false);
    expect(screen.getByRole("button", { name: /generate friendenza/i })).toBeInTheDocument();
    expect(screen.getByAltText(/source test rare friend/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /generate friendenza/i }));

    expect(useQuery.mock.lastCall?.[0].enabled).toBe(true);
    expect(screen.getByRole("status", { name: /generating friendenza/i })).toBeInTheDocument();
  });

  it("shows claimed tokens and prevents another claim", () => {
    useAccount.mockReturnValue({
      address: "0x35f733b22A851307aE10D6Ba4689510e6Febdc4f",
      chainId: targetChain.id,
      isConnected: true,
      isConnecting: false,
    });
    useGenesisTokens.mockReturnValue({
      data: [
        {
          tokenId: "43",
          name: "Test Rare Friend #43",
          imageUrl: "data:image/svg+xml,<svg/>",
          traits: { Eyes: "Pixel" },
          claimed: true,
        },
      ],
      isLoading: false,
      isError: false,
    });
    useQuery.mockImplementation((options: { enabled: boolean }) => ({
      data: options.enabled
        ? {
            svg: "<svg/>",
            svgDigest: `0x${"1".repeat(64)}`,
            generatorVersion: "friendenza-v3",
          }
        : undefined,
      isLoading: false,
      isFetching: false,
      error: null,
    }));

    render(<FriendenzaApp />);
    expect(screen.getByText(/token #43 · claimed/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /generate friendenza/i }));

    expect(screen.getByRole("button", { name: /already claimed/i })).toBeDisabled();
  });
});
