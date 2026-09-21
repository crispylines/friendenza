import { ImageResponse } from "next/og";
import { friendenzaDemoSvg } from "@/lib/generative/demo";

export const alt =
  "Friendenza — deterministic grayscale pixel-flow art for Rare Friends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const artwork = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(friendenzaDemoSvg)}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "64px 72px",
        color: "#f2f2ec",
        background: "#11120f",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          width: 570,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            marginBottom: 34,
            padding: "10px 14px",
            border: "2px solid #777970",
            fontSize: 22,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Rare Friends Genesis
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: -4,
          }}
        >
          FRIENDENZA
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            color: "#b9bbb2",
            fontSize: 29,
            lineHeight: 1.45,
          }}
        >
          Deterministic grayscale pixel-flow art, generated and claimed from
          your Rare Friend.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 42,
            fontSize: 24,
            letterSpacing: 2,
          }}
        >
          FRIENDENZA.COM →
        </div>
      </div>
      <div
        style={{
          width: 470,
          height: 470,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 14,
          border: "2px solid #777970",
          background: "#050505",
          boxShadow: "18px 18px 0 #262720",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artwork} width={438} height={438} alt="" />
      </div>
    </div>,
    size,
  );
}
