import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "DataQuest: SQL Master RPG",
    description: "Learn SQL in an RPG world with AI Sage assistance.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja">
            <body className={inter.className}>
                {children}
                <script src="//assets.v2.sprocket.bz/js/sprocket-jssdk.js#config=//assets.sprocket.bz/config/707b6671bf50418398c3a77aa9913c5f.json" charSet="UTF-8"></script>
            </body>
        </html>
    );
}
