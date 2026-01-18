import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "行政問い合わせシステム",
  description: "行政問い合わせ対応システム - AI Agent による自動応答",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}
      >
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-800">
                行政問い合わせシステム
              </h1>
              <nav className="flex gap-6">
                <Link
                  href="/inquiry"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  問い合わせ対応
                </Link>
                <Link
                  href="/residents"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  住民データ
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
