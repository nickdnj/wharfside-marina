import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";

export const metadata: Metadata = {
  title: "Forms",
  description:
    "Downloadable PDFs for Wharfside Marina: slip application, indemnification, gate-key request, and transient request.",
};

type Form = {
  id: string;
  title: string;
  description: string;
  url: string | null;
  audience: "Slip-owners" | "Public" | "Renters";
};

/**
 * URLs are intentionally `null` until the R2 bucket is provisioned
 * (STORY-06 + a follow-up to upload signed PDFs). When wired, swap
 * `url` to a signed-URL helper from `@/lib/storage/r2`.
 */
const FORMS: Form[] = [
  {
    id: "slip-application",
    title: "Slip application",
    description:
      "Required for new slip-holders. Identifies vessel, holder, and contact info; precedes the slip agreement.",
    url: null,
    audience: "Slip-owners",
  },
  {
    id: "indemnification",
    title: "Indemnification agreement",
    description:
      "Acknowledges marina rules and assumption of risk. Required at slip assignment.",
    url: null,
    audience: "Slip-owners",
  },
  {
    id: "gate-key-request",
    title: "Gate-key / fob request",
    description:
      "Request additional gate keys or fobs for family members and authorized guests.",
    url: null,
    audience: "Slip-owners",
  },
  {
    id: "transient-request",
    title: "Transient request (paper)",
    description:
      "Paper version of the online transient request — for those who prefer email or fax.",
    url: null,
    audience: "Public",
  },
  {
    id: "renter-lease-upload",
    title: "Renter lease — upload instructions",
    description:
      "For resident-renters: how to submit your sublease document for residency-rate eligibility.",
    url: null,
    audience: "Renters",
  },
];

export default function FormsPage() {
  return (
    <article>
      <PageHeader
        eyebrow="Forms library"
        title="Downloadable forms"
        lede="Marina forms in PDF. If a form you need isn't listed, contact ECI directly — they can email it to you."
      />

      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FORMS.map((f) => (
          <li
            key={f.id}
            className="flex flex-col rounded-xl border border-slate-100 bg-white p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold text-navy">
                {f.title}
              </h2>
              <span
                className="rounded-full bg-sand-100 px-2 py-0.5 text-xs font-semibold text-navy"
                aria-label={`Audience: ${f.audience}`}
              >
                {f.audience}
              </span>
            </div>
            <p className="mt-2 flex-1 text-sm text-slate-500">{f.description}</p>
            <div className="mt-4">
              {f.url ? (
                <a
                  href={f.url}
                  className="inline-flex h-9 items-center rounded-md bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-700"
                  download
                >
                  Download PDF &darr;
                </a>
              ) : (
                <span
                  className="inline-flex items-center gap-2 text-sm text-slate-500"
                  aria-live="polite"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full bg-warning"
                  />
                  Not yet posted — email ECI to request a copy.
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-slate-500">
        Need help with a form? Use the{" "}
        <Link className="text-navy hover:text-gold" href="/contact">
          contact page
        </Link>{" "}
        to reach ECI.
      </p>
    </article>
  );
}
