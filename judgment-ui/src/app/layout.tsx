import type { Metadata } from 'next';
import { Inter } from 'next/font/google'
import './globals.css';
import Link from 'next/link';
import type { ReactNode } from "react";


const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'AGA Judgment UI',
    description: 'Action-Gated Authorization - Judgment Viewer',
};

export default function RootLayout({
    children,
}: {
    children: ReactNode;
}){
    return(
        <html lang="ja">
            <body className={inter.className}>
                {/* ヘッダー */}
                <header className="bg-gray-900 text-white p-4">
                    <nav className="container mx-auto flex items-center gap-6">
                        <Link href="/dashboard" className="hover:underline">
                            Judgment
                        </Link>
                        <Link href="/dashboard" className="hover:underline">
                            Dashboard
                        </Link>
                    </nav>
                </header>

                {/* メインコンテンツ */}
                <div className="container mx-auto">
                    {children}
                </div>
            </body>
        </html>
    )
}
