import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about Wharfside Marina: pets, smoking, generators, dinghy storage, garbage and recycling.",
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Are pets allowed?",
    a: "Yes, leashed. Owners must clean up; waste bags and bins are at the gangway and head house.",
  },
  {
    q: "Can I smoke at the marina?",
    a: "Smoking is not permitted on docks, finger piers, or in the head house. Smoking on your own vessel is at your discretion provided ashes and butts are contained.",
  },
  {
    q: "When can I run my generator?",
    a: "Daylight hours only, and only as needed for vessel systems. Generators are not permitted during quiet hours (10:00 pm – 7:00 am).",
  },
  {
    q: "Where can I store my dinghy or kayak?",
    a: "Tenders may be stored on davits or alongside your vessel. Free-standing dinghy, kayak, or paddleboard storage on docks or finger piers is not permitted.",
  },
  {
    q: "Where are the trash and recycling bins?",
    a: "At the head house. Do not dispose of oil, oily rags, paint, batteries, or hazardous materials in marina trash — see the dockmaster for proper disposal.",
  },
  {
    q: "Is there a pump-out at the marina?",
    a: "Holding-tank pump-out is by appointment. Contact the dockmaster on VHF channel 9 or via the after-hours line for scheduling.",
  },
  {
    q: "Is there a fuel dock?",
    a: "Wharfside does not operate a fuel dock. Nearby fuel options are listed on the Local services page.",
  },
  {
    q: "Where can I shower or do laundry?",
    a: "Slip-holder showers are in the head house. Laundry is not provided on-site; commercial options are listed under Local services.",
  },
  {
    q: "Can I host guests on my slip?",
    a: "Yes. You are responsible for your guests' conduct, including children and pets. Overnight guests should be reported to the dockmaster as a courtesy.",
  },
  {
    q: "Do I need insurance on my vessel?",
    a: "Yes — a current Certificate of Insurance naming Wharfside Manor Condominium Association and ECI as additional insureds is required for every vessel in a Wharfside slip. See the Forms page for the required liability minimum.",
  },
  {
    q: "How do I request a transient slip?",
    a: "Use the public transient request form. Approved requests receive a confirmation email with COI and registration upload instructions.",
  },
  {
    q: "How do I sign in as a slip owner?",
    a: "Slip-owner sign-in uses a magic-link emailed to the address on file with ECI. No password to remember.",
  },
];

export default function FaqPage() {
  return (
    <article>
      <PageHeader
        eyebrow="Frequently asked"
        title="FAQ"
        lede="Quick answers to the questions we hear most often. If you don't see what you're looking for, contact ECI or the dockmaster."
      />

      <dl className="mt-8 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
        {FAQS.map((f, i) => (
          <details
            key={i}
            className="group px-6 py-4 open:bg-paper sm:px-8"
            name="faq"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
              <dt className="font-serif text-lg font-semibold text-navy">
                {f.q}
              </dt>
              <span
                aria-hidden="true"
                className="text-xl text-slate-500 transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <dd className="mt-3 text-base leading-7 text-slate-900">{f.a}</dd>
          </details>
        ))}
      </dl>

      <p className="mt-8 text-sm text-slate-500">
        Have a question we should add? Email it to the{" "}
        <Link className="text-navy hover:text-gold" href="/contact">
          ECI office
        </Link>
        .
      </p>
    </article>
  );
}
