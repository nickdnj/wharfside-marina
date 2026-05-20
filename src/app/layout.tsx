import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://wharfsidemb.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Wharfside Marina",
    template: "%s · Wharfside Marina",
  },
  description:
    "Wharfside Manor Condominium Association marina — rules, map, forms, and transient slip requests on the Shrewsbury River in Monmouth Beach, NJ.",
  applicationName: "Wharfside Marina",
  authors: [{ name: "Wharfside Manor Condominium Association" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Wharfside Marina",
    title: "Wharfside Marina",
    description:
      "A private slip community on the Shrewsbury River in Monmouth Beach, NJ.",
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wharfside Marina",
    description:
      "A private slip community on the Shrewsbury River in Monmouth Beach, NJ.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-paper text-slate-900 antialiased">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
