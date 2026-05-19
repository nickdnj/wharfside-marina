import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wharfside Marina",
  description: "Wharfside Manor marina management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-navy-50 text-navy-900 antialiased">{children}</body>
    </html>
  );
}
