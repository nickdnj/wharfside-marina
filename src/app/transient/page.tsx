import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { TransientForm } from "./TransientForm";

export const metadata: Metadata = {
  title: "Request a transient slip",
  description:
    "Submit a transient slip request at Wharfside Marina. ECI will respond within 24 hours.",
};

export default function TransientPage() {
  return (
    <article>
      <PageHeader
        eyebrow="Visiting boaters"
        title="Request a transient slip"
        lede="Wharfside Marina has a small number of transient slips available by approval. Submit the form below and we'll respond within 24 hours."
      />
      <TransientForm />
    </article>
  );
}
