import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { SlipMap } from "@/components/site/SlipMap";

export const metadata: Metadata = {
  title: "Marina map",
  description:
    "Read-only layout of Wharfside Marina's three docks and 86 slips on the Shrewsbury River.",
};

export default function MapPage() {
  return (
    <article>
      <PageHeader
        eyebrow="Layout"
        title="Marina map"
        lede="Three docks (A, B, C) totaling 86 slips on the Shrewsbury River in Monmouth Beach. The layout is read-only — for approach instructions and VHF hailing, see the marina rules."
      />

      <div className="mt-8">
        <SlipMap />
      </div>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-navy">
            Approach
          </h2>
          <p className="mt-2 text-sm text-slate-900">
            Hail on VHF channel 9 before entering. Maintain no-wake speed inside
            the breakwater and in the fairway at all times.
          </p>
          <p className="mt-3 text-sm">
            <Link className="text-navy hover:text-gold" href="/rules#approach-and-fairway">
              Read the full approach &amp; fairway rules &rarr;
            </Link>
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-navy">
            Transient slips
          </h2>
          <p className="mt-2 text-sm text-slate-900">
            A small number of slips are available to visiting boaters by
            approval. Submit a request and the dockmaster will respond within
            24 hours.
          </p>
          <p className="mt-3 text-sm">
            <Link className="text-navy hover:text-gold" href="/transient">
              Request a transient slip &rarr;
            </Link>
          </p>
        </div>
      </section>
    </article>
  );
}
