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
  title: "Friendenza",
  description: "Generate and claim grayscale pixel art for your Rare Friends.",
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
