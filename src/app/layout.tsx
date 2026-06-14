import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopNav, type NavLink } from "@/components/TopNav";
import { isLocalMode } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TOEFL Complete-the-Words Tutor",
  description: "Practise TOEFL Complete the Words questions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const links: NavLink[] = isLocalMode()
    ? [
        { href: "/", label: "Practice" },
        { href: "/words", label: "Words" },
        { href: "/flashcards", label: "Flashcards" },
      ]
    : [
        { href: "/review", label: "Review" },
        { href: "/words", label: "Words" },
        { href: "/flashcards", label: "Flashcards" },
      ];

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TopNav links={links} />
        {children}
      </body>
    </html>
  );
}
