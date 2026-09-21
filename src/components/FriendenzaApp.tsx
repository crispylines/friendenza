"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useAccount,
  usePublicClient,
  useSignMessage,
  useWriteContract,
} from "wagmi";
import type { Hex } from "viem";
import { WalletButton } from "./WalletButton";
import { generateFriendenza } from "@/lib/generative/friendenza";
import { targetChain } from "@/lib/web3/config";
import {
  CLAIMS_CONFIGURED,
  FRIENDENZA_ABI,
  FRIENDENZA_CONTRACT,
} from "@/lib/web3/friendenza";
import { useGenesisTokens, type WalletGenesisToken } from "@/hooks/useGenesisTokens";

type ClaimStage =
  | "idle"
  | "signing"
  | "preparing"
  | "wallet"
  | "confirming"
  | "success"
  | "error";

interface Preview {
  svg: string;
  svgDigest: Hex;
  generatorVersion: string;
}

const demoSvg = generateFriendenza({
  tokenId: BigInt(1024),
  seed: 0xf13e4d2a,
  version: "friendenza-v2",
  traits: { Mood: "Rare", Form: "Pixel" },
  tonalProfile: {
    mean: 0.54,
    contrast: 0.76,
    histogram: [0.12, 0.09, 0.1, 0.14, 0.18, 0.15, 0.12, 0.1],
  },
}).svg;

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function stageLabel(stage: ClaimStage) {
  return {
    idle: "claim friendenza",
    signing: "sign the wallet message…",
    preparing: "pinning your art…",
    wallet: "confirm in wallet…",
    confirming: "confirming onchain…",
    success: "friendenza claimed",
    error: "try claim again",
  }[stage];
}

export function FriendenzaApp() {
  const { address, chainId, isConnected } = useAccount();
  const tokensQuery = useGenesisTokens(
    isConnected && chainId === targetChain.id ? address : undefined,
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [claimStage, setClaimStage] = useState<ClaimStage>("idle");
  const [claimError, setClaimError] = useState<string>();
  const [transactionHash, setTransactionHash] = useState<Hex>();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: targetChain.id });
  const effectiveSelectedId = selectedId ?? tokensQuery.data?.[0]?.tokenId;
  const selectedToken = useMemo(
    () => tokensQuery.data?.find((token) => token.tokenId === effectiveSelectedId),
    [effectiveSelectedId, tokensQuery.data],
  );
  const previewQuery = useQuery({
    queryKey: ["friendenza-preview", address, effectiveSelectedId],
    enabled: Boolean(address && effectiveSelectedId),
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/preview/${address}/${effectiveSelectedId}`,
        { signal },
      );
      const payload = (await response.json()) as Preview & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Preview failed");
      return payload;
    },
    staleTime: 5 * 60 * 1000,
  });
  const preview = previewQuery.data;
  const previewLoading = previewQuery.isLoading || previewQuery.isFetching;
  const previewError = previewQuery.error?.message;

  function selectToken(token: WalletGenesisToken) {
    setSelectedId(token.tokenId);
    setClaimStage("idle");
    setClaimError(undefined);
    setTransactionHash(undefined);
  }

  async function claimSelected() {
    if (!address || !selectedToken || !publicClient || !CLAIMS_CONFIGURED) return;
    setClaimError(undefined);
    setTransactionHash(undefined);

    try {
      setClaimStage("signing");
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const challenge = (await challengeResponse.json()) as {
        token?: string;
        message?: string;
        error?: string;
      };
      if (!challengeResponse.ok || !challenge.token || !challenge.message) {
        throw new Error(challenge.error ?? "Unable to create wallet challenge");
      }
      const walletSignature = await signMessageAsync({ message: challenge.message });

      setClaimStage("preparing");
      const claimResponse = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address,
          tokenId: selectedToken.tokenId,
          message: challenge.message,
          signature: walletSignature,
          challengeToken: challenge.token,
        }),
      });
      const claim = (await claimResponse.json()) as {
        tokenUri?: string;
        metadataDigest?: Hex;
        deadline?: number;
        signature?: Hex;
        error?: string;
      };
      if (
        !claimResponse.ok ||
        !claim.tokenUri ||
        !claim.metadataDigest ||
        !claim.deadline ||
        !claim.signature
      ) {
        throw new Error(claim.error ?? "Unable to prepare claim");
      }

      setClaimStage("wallet");
      const hash = await writeContractAsync({
        address: FRIENDENZA_CONTRACT,
        abi: FRIENDENZA_ABI,
        functionName: "claim",
        args: [
          BigInt(selectedToken.tokenId),
          claim.tokenUri,
          claim.metadataDigest,
          BigInt(claim.deadline),
          claim.signature,
        ],
        chain: targetChain,
        account: address,
      });
      setTransactionHash(hash);
      setClaimStage("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Claim transaction reverted");
      setClaimStage("success");
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Claim failed");
      setClaimStage("error");
    }
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Friendenza home">
          friende<span>nza</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#generate">generate</a>
          <a href="#how-it-works">how it works</a>
          <a href="https://rarefriends.com/" target="_blank" rel="noreferrer">
            rare friends ↗
          </a>
        </nav>
        <WalletButton />
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">rare friends × flow fields</p>
            <h1 aria-label="Make your friend flow.">
              Make your
              <br />
              friend flow.
            </h1>
            <p className="lede">
              One deterministic black, white and grayscale pixel composition for every
              Rare Friends Genesis NFT.
            </p>
            <a className="pixel-button hero-action" href="#generate">
              generate yours
            </a>
          </div>
          <div className="hero-art" aria-label="Example Friendenza pixel artwork">
            {/* Generated internally from trusted deterministic SVG. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgDataUrl(demoSvg)} alt="Example grayscale Friendenza flow field" />
            <span className="cross cross-one">+</span>
            <span className="cross cross-two">+</span>
          </div>
        </section>

        <section className="generator-section" id="generate">
          <div className="section-heading">
            <p className="eyebrow">holder studio</p>
            <h2>Your friends</h2>
            <p>Connect the wallet that holds your Genesis NFT. Ownership is rechecked onchain.</p>
          </div>

          {!isConnected ? (
            <div className="empty-state">
              <span>01</span>
              <h3>connect to begin</h3>
              <p>Your wallet stays in control. Friendenza never requests token approvals.</p>
              <WalletButton />
            </div>
          ) : chainId !== targetChain.id ? (
            <div className="empty-state">
              <span>network</span>
              <h3>Robinhood Chain required</h3>
              <p>Switch networks to find the Rare Friends in this wallet.</p>
              <WalletButton />
            </div>
          ) : tokensQuery.isLoading ? (
            <div className="empty-state scanlines">
              <span>scanning</span>
              <h3>finding your friends…</h3>
            </div>
          ) : tokensQuery.isError ? (
            <div className="empty-state">
              <span>error</span>
              <h3>chain data did not load</h3>
              <p>{tokensQuery.error.message}</p>
              <button className="pixel-button" type="button" onClick={() => tokensQuery.refetch()}>
                retry
              </button>
            </div>
          ) : tokensQuery.data?.length === 0 ? (
            <div className="empty-state">
              <span>0 friends</span>
              <h3>no Genesis NFTs found</h3>
              <p>Try another wallet or return after a Genesis arrives.</p>
            </div>
          ) : (
            <div className="studio">
              <aside className="friend-list" aria-label="Owned Rare Friends">
                {tokensQuery.data?.map((token) => (
                  <button
                    type="button"
                    className={`friend-row ${effectiveSelectedId === token.tokenId ? "selected" : ""}`}
                    key={token.tokenId}
                    onClick={() => selectToken(token)}
                  >
                    <span className="friend-thumb">
                      {token.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={token.imageUrl} alt="" />
                      ) : (
                        "+"
                      )}
                    </span>
                    <span>
                      <strong>{token.name}</strong>
                      <small>token #{token.tokenId}</small>
                    </span>
                    <b>→</b>
                  </button>
                ))}
              </aside>

              <article className="preview-panel">
                <div className="preview-frame">
                  {previewLoading ? (
                    <div className="preview-message scanlines">rendering flow field…</div>
                  ) : previewError ? (
                    <div className="preview-message">{previewError}</div>
                  ) : preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={svgDataUrl(preview.svg)} alt={`Friendenza for ${selectedToken?.name}`} />
                  ) : null}
                </div>
                <div className="preview-meta">
                  <div>
                    <p className="eyebrow">{preview?.generatorVersion ?? "friendenza-v2"}</p>
                    <h3>{selectedToken ? `Friendenza #${selectedToken.tokenId}` : "select a friend"}</h3>
                  </div>
                  <dl>
                    <div>
                      <dt>palette</dt>
                      <dd>8-tone grayscale</dd>
                    </div>
                    <div>
                      <dt>source</dt>
                      <dd>{selectedToken?.name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>output</dt>
                      <dd>512 × 512 SVG</dd>
                    </div>
                  </dl>

                  {claimStage === "success" ? (
                    <div className="claim-success" role="status">
                      <strong>claimed on Robinhood Chain.</strong>
                      {transactionHash ? (
                        <a
                          href={`${targetChain.blockExplorers.default.url}/tx/${transactionHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          view transaction ↗
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="pixel-button claim-button"
                        disabled={
                          !selectedToken ||
                          !preview ||
                          previewLoading ||
                          !CLAIMS_CONFIGURED ||
                          !["idle", "error"].includes(claimStage)
                        }
                        onClick={claimSelected}
                      >
                        {CLAIMS_CONFIGURED ? stageLabel(claimStage) : "claims opening soon"}
                      </button>
                      {claimError ? <p className="form-error" role="alert">{claimError}</p> : null}
                    </>
                  )}
                </div>
              </article>
            </div>
          )}
        </section>

        <section className="how-section" id="how-it-works">
          <p className="eyebrow">how it works</p>
          <div className="steps">
            <article>
              <span>01</span>
              <h3>hold</h3>
              <p>Connect the current owner wallet for a Rare Friends Genesis NFT.</p>
            </article>
            <article>
              <span>02</span>
              <h3>generate</h3>
              <p>Token traits and source tones shape a permanent pixel flow field.</p>
            </article>
            <article>
              <span>03</span>
              <h3>claim</h3>
              <p>Mint one Friendenza for that source token. The contract rechecks ownership.</p>
            </article>
          </div>
        </section>
      </main>

      <footer>
        <strong>friendenza</strong>
        <p>an authorized Rare Friends community project</p>
        <a href="https://rarefriends.com/" target="_blank" rel="noreferrer">
          rarefriends.com ↗
        </a>
      </footer>
    </div>
  );
}
