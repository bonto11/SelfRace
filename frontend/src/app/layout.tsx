import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Trainalyze",
  description: "AI-powered training insights",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 dark:bg-gray-900">
        {children}
      </body>
    </html>
  );
}
