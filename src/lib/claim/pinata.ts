function requireCid(value: unknown): string {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  const cid = record?.IpfsHash;
  if (typeof cid !== "string" || !/^[a-zA-Z0-9]+$/.test(cid)) {
    throw new Error("Pinning provider returned an invalid CID");
  }
  return cid;
}

export function createPinataClient(jwt: string) {
  if (!jwt) throw new Error("PINATA_JWT is not configured");
  const authorization = `Bearer ${jwt}`;

  return {
    async pinSvg(name: string, svg: string): Promise<string> {
      const form = new FormData();
      form.append("file", new Blob([svg], { type: "image/svg+xml" }), name);
      form.append("pinataMetadata", JSON.stringify({ name }));
      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { authorization },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`SVG pin failed (${response.status})`);
      return requireCid(await response.json());
    },

    async pinJson(name: string, value: unknown): Promise<string> {
      const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          pinataMetadata: { name },
          pinataContent: value,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Metadata pin failed (${response.status})`);
      return requireCid(await response.json());
    },
  };
}
