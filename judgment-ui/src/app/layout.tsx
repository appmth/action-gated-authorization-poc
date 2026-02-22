import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import type { ReactNode } from "react";
import { QueryProvider } from "./QueryProvider";
import { SidebarProvider } from "./SidebarContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AGA Judgment UI",
  description: "Action-Gated Authorization - Judgment Viewer",
  icons: {
    icon: "/judgment-ui-favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <QueryProvider>
        <SidebarProvider>
          {/* Top Bar */}
          <TopBar />

          {/* Body: Sidebar + Main */}
          <div className="flex" style={{ height: "calc(100vh - 48px)" }}>
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-gray-50">
              {children}
            </main>
          </div>
        </SidebarProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
