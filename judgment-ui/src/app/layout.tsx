import type { Metadata } from 'next';
import { Inter } from 'next/font/google'
import './globals.css';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Judgment | Action-Gated Authorization',
    description: 'Judgment Management Dashboard',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <body className={`${inter.className} bg-gray-50 text-gray-900`}>
                <TopBar />
                <Sidebar />
                <main className="ml-64 mt-16 p-8 min-h-[calc(100vh-64px)]">
                    {children}
                </main>
            </body>
        </html>
    )
}
