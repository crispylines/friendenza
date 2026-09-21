import type { Metadata } from "next";
import { Geist_Mono, Silkscreen } from "next/font/google";
import { Web3Provider } from "@/components/Web3Provider";
import "./globals.css";

const pixelFont = Silkscreen({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://friendenza.com"),
  title: {
    default: "Friendenza — Generative Art for Rare Friends",
    template: "%s | Friendenza",
  },
  description:
    "Turn an owned Rare Friends Genesis NFT into deterministic grayscale pixel-flow art, then claim it on Robinhood Chain.",
  applicationName: "Friendenza",
  creator: "@qrimeCapital",
  category: "Generative art",
  keywords: [
    "Friendenza",
    "Rare Friends",
    "generative art",
    "pixel art",
    "NFT",
    "Robinhood Chain",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Friendenza",
    title: "Friendenza — Generative Art for Rare Friends",
    description:
      "Generate deterministic grayscale pixel-flow art from your Rare Friends Genesis NFT and claim it onchain.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Friendenza — Generative Art for Rare Friends",
    description:
      "Generate deterministic grayscale pixel-flow art from your Rare Friends Genesis NFT and claim it onchain.",
    creator: "@qrimeCapital",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${pixelFont.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
