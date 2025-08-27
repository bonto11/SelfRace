import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trainalyze",
  description: "AI-powered training insights",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
