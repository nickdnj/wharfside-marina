import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Request received",
  description: "Your Wharfside Marina transient request has been received.",
  robots: { index: false, follow: false },
};

export default function TransientThanksPage() {
  return (
    <article className="mx-auto max-w-xl text-center">
      <div
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-3xl text-success"
      >
        ✓
      </div>
      <h1 className="mt-6 text-3xl font-bold">Request received.</h1>
      <p className="mt-4 text-base text-slate-900">
        Thanks for reaching out. We&apos;ll respond within 24 hours. Approved
        requests will receive an email with a secure link to upload your
        certificate of insurance and vessel registration &mdash; you&apos;ll
        have 48 hours to complete that step before arrival.
      </p>
      <p className="mt-6 text-sm text-slate-500">
        Questions in the meantime? Contact{" "}
        <a href="tel:+17327511991" className="text-navy hover:text-gold">
          ECI at 732-751-1991
        </a>{" "}
        or{" "}
        <Link href="/contact" className="text-navy hover:text-gold">
          visit the contact page
        </Link>
        .
      </p>
      <div className="mt-10 flex justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md border border-navy px-4 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
        >
          Back to home
        </Link>
        <Link
          href="/rules"
          className="inline-flex h-10 items-center rounded-md bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-700"
        >
          Read the marina rules
        </Link>
      </div>
    </article>
  );
}
