import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tyson Artwork Tool",
  description: "Internal tool for Tyson artwork request intake and concept generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  T
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">Tyson Artwork Tool</p>
                  <p className="text-xs text-muted-foreground">V1 — Concept Intake</p>
                </div>
              </Link>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Internal use only
              </span>
            </div>
          </header>
          <main className="flex-1 px-4 py-8 sm:px-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
