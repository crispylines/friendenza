import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendenzaApp } from "./FriendenzaApp";

const { useAccount } = vi.hoisted(() => ({
  useAccount: vi.fn(),
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
  useQuery: () => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useGenesisTokens", () => ({
  useGenesisTokens: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
  }),
}));

describe("FriendenzaApp", () => {
  beforeEach(() => {
    useAccount.mockReturnValue({
      address: undefined,
      chainId: undefined,
      isConnected: false,
      isConnecting: false,
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
});
