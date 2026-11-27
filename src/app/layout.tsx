import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_SC } from "next/font/google";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import { PRODUCT_DOCUMENT_TITLE, PRODUCT_NAME_EN, PRODUCT_NAME_ZH } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const noto = Noto_Sans_SC({
  variable: "--font-noto",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: PRODUCT_DOCUMENT_TITLE,
  description: `${PRODUCT_NAME_ZH}（${PRODUCT_NAME_EN}）。面向义乌市场采购公司的外贸选品工作台：按需推荐与行情推新。`,
  icons: { icon: [{ url: "/logo-zk.png", type: "image/png" }] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${noto.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>
          <Suspense fallback={<div className="p-6 text-sm">正在打开{PRODUCT_NAME_ZH}…</div>}>
            <Shell>{children}</Shell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
