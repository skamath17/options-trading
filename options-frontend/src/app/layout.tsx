"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { PositionsProvider } from "@/context/PositionsContext";
import { startOptionChainRefresh } from "@/services/optionChainService";
import { useEffect } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    let cleanupFn: () => void;

    if (typeof window !== "undefined") {
      cleanupFn = startOptionChainRefresh();
    }

    return () => {
      cleanupFn?.(); // Call cleanup if it exists
    };
  }, []);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PositionsProvider>{children}</PositionsProvider>
      </body>
    </html>
  );
}
