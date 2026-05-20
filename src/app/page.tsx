import { Hero } from "@/components/site/Hero";
import { ActionCards } from "@/components/site/ActionCards";
import { QuickInfo } from "@/components/site/QuickInfo";
import { TideEmbed } from "@/components/site/TideEmbed";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://wharfsidemb.com";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["LocalBusiness", "Marina"],
      "@id": `${SITE_URL}/#marina`,
      name: "Wharfside Marina",
      description:
        "A private slip community on the Shrewsbury River, operated for the Wharfside Manor Condominium Association.",
      url: SITE_URL,
      telephone: "+1-732-751-1991",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Monmouth Beach",
        addressRegion: "NJ",
        addressCountry: "US",
      },
      areaServed: {
        "@type": "Place",
        name: "Shrewsbury River, Monmouth Beach, NJ",
      },
      knowsAbout: ["Transient slip rentals", "Slip leases", "Marina rules"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Wharfside Marina",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#marina` },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <ActionCards />
      <QuickInfo />
      <TideEmbed />
    </>
  );
}
