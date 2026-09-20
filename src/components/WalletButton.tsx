"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { targetChain } from "@/lib/web3/config";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { address, chainId, isConnected, isConnecting } = useAccount();
  const { connectors, connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const connector = connectors[0];

  if (!isConnected || !address) {
    return (
      <div className="wallet-control">
        <button
          type="button"
          className="pixel-button"
          disabled={!connector || isConnecting}
          onClick={() => connector && connect({ connector, chainId: targetChain.id })}
        >
          {isConnecting ? "connecting…" : "connect wallet"}
        </button>
        {connectError ? <p role="alert">Wallet connection failed. Please retry.</p> : null}
      </div>
    );
  }

  if (chainId !== targetChain.id) {
    return (
      <div className="wallet-control">
        <button
          type="button"
          className="pixel-button"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: targetChain.id })}
        >
          {isSwitching ? "switching…" : `switch to ${targetChain.name}`}
        </button>
        <button type="button" className="text-button" onClick={() => disconnect()}>
          disconnect {shortAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-control">
      <span aria-label={`Connected wallet ${address}`}>{shortAddress(address)}</span>
      <button type="button" className="text-button" onClick={() => disconnect()}>
        disconnect
      </button>
    </div>
  );
}
