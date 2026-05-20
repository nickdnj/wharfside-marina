import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Marina rules",
  description:
    "Wharfside Marina rules — VHF hailing, approach, fueling, wakes, conduct, and seasonal procedures, lifted from the WMCA Handbook.",
};

type Section = {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
};

const SECTIONS: Section[] = [
  {
    id: "hailing-and-vhf",
    title: "Hailing & VHF",
    paragraphs: [
      "Hail Wharfside Marina on VHF channel 9. Channel 16 is for distress only — switch to a working channel after first contact.",
      "Identify your vessel by name and slip assignment (or transient request reference) and stand by for the dockmaster's reply.",
    ],
  },
  {
    id: "approach-and-fairway",
    title: "Approach & fairway",
    paragraphs: [
      "Approach the marina from the Shrewsbury River channel. Maintain no-wake speed inside the breakwater and in the fairway at all times.",
      "Right-of-way: vessels leaving slips yield to vessels under way in the fairway. Stop and hold position rather than passing in a tight turn.",
    ],
  },
  {
    id: "fueling",
    title: "Fueling",
    paragraphs: [
      "Wharfside Marina does not operate a fuel dock. The nearest fuel options are listed on the Local services page.",
      "Refueling at your slip from portable containers is prohibited.",
    ],
  },
  {
    id: "wakes-and-speed",
    title: "Wakes & speed",
    paragraphs: [
      "Operate at idle speed inside the breakwater. You are responsible for any damage caused by your wake — to other vessels, to lifts, to floating docks, and to swimmers.",
    ],
  },
  {
    id: "noise-and-conduct",
    title: "Noise & conduct",
    paragraphs: [
      "Quiet hours: 10:00 pm to 7:00 am. Generators, hailers, and amplified music are not permitted during quiet hours.",
      "Slip-holders are responsible for the conduct of their guests, including children and pets.",
    ],
  },
  {
    id: "generators-and-power",
    title: "Generators & shore power",
    paragraphs: [
      "Onboard generators may be run only during daylight hours and only as needed for vessel systems.",
      "Use only marine-rated shore-power cables in good condition. Report any pedestal faults to the dockmaster immediately and do not attempt a repair yourself.",
    ],
  },
  {
    id: "pets",
    title: "Pets",
    paragraphs: [
      "Pets are welcome on the property when leashed. Owners must clean up after their animals; waste bags and bins are located near the gangway and head house.",
    ],
  },
  {
    id: "dinghies-kayaks-tenders",
    title: "Dinghies, kayaks, tenders",
    paragraphs: [
      "Tenders may be stored on davits or alongside, provided they do not protrude into the fairway. Free-standing storage of dinghies, kayaks, or paddleboards on docks or finger piers is not permitted.",
    ],
  },
  {
    id: "trash-recycling-pump-out",
    title: "Trash, recycling, pump-out",
    paragraphs: [
      "Use the trash and recycling bins at the head house. Do not deposit oil, oily rags, paint, batteries, or hazardous materials in these bins.",
      "Holding-tank pump-out is by appointment — contact the dockmaster.",
    ],
  },
  {
    id: "insurance-and-documents",
    title: "Insurance & documents",
    paragraphs: [
      "Every vessel in a Wharfside slip must carry a current Certificate of Insurance (COI) and current state registration on file with ECI.",
      "Coverage must name Wharfside Manor Condominium Association and ECI as additional insureds. Required liability minimums are published on the Forms page and in your slip agreement.",
    ],
  },
  {
    id: "storms-and-haul-out",
    title: "Storm preparation & seasonal haul-out",
    paragraphs: [
      "When a named storm is forecast for our area, follow the dockmaster's instructions promptly. Slip-holders are responsible for doubling lines, removing canvas, and securing loose gear.",
      "End-of-season haul-out windows and decommissioning checklists are published before October 1 each year.",
    ],
  },
  {
    id: "emergencies",
    title: "Emergencies",
    paragraphs: [
      "Life-threatening emergencies: dial 911. After-hours marina issues: 732-970-6886.",
      "Spills (fuel, oil, sewage) must be reported immediately to the dockmaster and to the U.S. Coast Guard National Response Center at 1-800-424-8802.",
    ],
  },
];

export default function RulesPage() {
  return (
    <article className="grid grid-cols-1 gap-10 lg:grid-cols-[16rem,1fr]">
      <aside aria-label="Table of contents" className="lg:sticky lg:top-[68px] lg:self-start">
        <details className="rounded-lg border border-slate-100 bg-white open:bg-paper lg:open:bg-white" open>
          <summary className="cursor-pointer list-none px-4 py-3 font-serif text-base font-semibold text-navy lg:cursor-default lg:py-3">
            On this page
          </summary>
          <nav className="px-4 pb-4 lg:pt-1">
            <ol className="space-y-1.5 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <Link
                    href={`#${s.id}`}
                    className="text-slate-500 hover:text-navy"
                  >
                    <span className="font-mono text-xs text-slate-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>{" "}
                    {s.title}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </details>
      </aside>

      <div className="prose-rules">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">
            WMCA Handbook · Marina Area
          </p>
          <h1 className="mt-2 text-4xl font-bold">Marina rules</h1>
          <p className="mt-3 text-base text-slate-500">
            These rules apply to every vessel and slip-holder at Wharfside
            Marina. They are excerpted from the WMCA Handbook; the Handbook is
            the source of truth in case of conflict.
          </p>
          <div className="mt-4 flex gap-3 print:hidden">
            <a
              href="#hailing-and-vhf"
              className="inline-flex h-9 items-center rounded-md border border-navy px-3 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
            >
              Start reading &rarr;
            </a>
          </div>
        </header>

        {SECTIONS.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-heading`}
            className="mt-10 scroll-mt-20"
          >
            <h2
              id={`${s.id}-heading`}
              className="group flex items-baseline gap-2 text-2xl font-semibold"
            >
              <span className="font-mono text-sm text-slate-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Link href={`#${s.id}`} className="hover:text-gold">
                {s.title}
              </Link>
            </h2>
            {s.paragraphs.map((p, j) => (
              <p key={j} className="mt-4 text-base leading-7 text-slate-900">
                {p}
              </p>
            ))}
            {s.list && (
              <ul className="mt-4 list-disc space-y-1 pl-6 text-base leading-7 text-slate-900">
                {s.list.map((item, k) => (
                  <li key={k}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <footer className="mt-12 border-t border-slate-100 pt-6 text-sm text-slate-500">
          <p>
            Questions? Contact ECI at{" "}
            <a className="text-navy hover:text-gold" href="tel:+17327511991">
              732-751-1991
            </a>{" "}
            or visit the{" "}
            <Link className="text-navy hover:text-gold" href="/contact">
              Contact page
            </Link>
            .
          </p>
        </footer>
      </div>
    </article>
  );
}
