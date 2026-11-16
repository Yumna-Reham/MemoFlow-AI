import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const landingFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-landing",
});

export const metadata: Metadata = {
  title: "MemoFlow — Save Anything",
  description: "An AI Memory Workspace that automatically organizes, connects, and resurfaces information (notes, images, voice notes, PDFs, links) whenever it becomes useful.",
  keywords: ["AI Memory", "SaaS Notes", "ADHD Organizer", "Knowledge Graph", "Voice Assistant", "Readwise Alternative"],
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${landingFont.variable} font-sans h-full scroll-smooth`}>
      <body className="h-full bg-memobg text-memotext antialiased select-none font-sans">
        {children}
      </body>
    </html>
  );
}
