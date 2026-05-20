import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach the Wharfside Marina dockmaster and ECI office. Tap-to-call links for mobile.",
};

type ContactCard = {
  role: string;
  name?: string;
  phones: Array<{ label: string; tel: string; display: string }>;
  email?: string;
  hours?: string;
  notes?: string;
};

const CONTACTS: ContactCard[] = [
  {
    role: "ECI office — slip agreements, billing, documents",
    name: "Kathy Vanecek, property manager",
    phones: [{ label: "Office", tel: "+17327511991", display: "732-751-1991" }],
    email: "kathy.vanecek@idealmgt.com",
    hours: "Mon–Fri, 9:00 am – 5:00 pm",
  },
  {
    role: "Dockmaster — slip operations, day-of issues",
    phones: [{ label: "VHF", tel: "", display: "Channel 9" }],
    notes:
      "Hail on VHF channel 9 during open-water hours, or call the after-hours line below for urgent issues.",
  },
  {
    role: "After-hours marina emergency",
    phones: [{ label: "24/7", tel: "+17329706886", display: "732-970-6886" }],
    notes:
      "Use for fire, sinking, severe damage, missing persons, or anything that cannot wait until morning. For life-threatening emergencies dial 911 first.",
  },
];

export default function ContactPage() {
  return (
    <article>
      <PageHeader
        eyebrow="Get in touch"
        title="Contact Wharfside Marina"
        lede="Wharfside Marina is operated for the Wharfside Manor Condominium Association by Ideal Condominium Inc. (ECI). Slip agreements, billing, and document review go through ECI; on-water operations go through the dockmaster."
      />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {CONTACTS.map((c) => (
          <section
            key={c.role}
            className="flex flex-col rounded-xl border border-slate-100 bg-white p-6"
          >
            <h2 className="font-serif text-lg font-semibold text-navy">{c.role}</h2>
            {c.name && (
              <p className="mt-1 text-sm text-slate-500">{c.name}</p>
            )}
            <dl className="mt-4 space-y-3">
              {c.phones.map((p) => (
                <div key={p.display}>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    {p.label}
                  </dt>
                  <dd className="font-serif text-xl font-semibold text-navy">
                    {p.tel ? (
                      <a href={`tel:${p.tel}`} className="hover:text-gold">
                        {p.display}
                      </a>
                    ) : (
                      p.display
                    )}
                  </dd>
                </div>
              ))}
              {c.email && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    Email
                  </dt>
                  <dd>
                    <a
                      href={`mailto:${c.email}`}
                      className="text-base text-navy hover:text-gold"
                    >
                      {c.email}
                    </a>
                  </dd>
                </div>
              )}
              {c.hours && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    Hours
                  </dt>
                  <dd className="text-sm text-slate-900">{c.hours}</dd>
                </div>
              )}
            </dl>
            {c.notes && (
              <p className="mt-4 text-sm text-slate-500">{c.notes}</p>
            )}
          </section>
        ))}
      </div>

      <section
        aria-labelledby="address"
        className="mt-12 rounded-xl border border-slate-100 bg-white p-6 sm:p-8"
      >
        <h2 id="address" className="text-2xl font-semibold">
          Where we are
        </h2>
        <p className="mt-3 text-base text-slate-900">
          Wharfside Manor Marina, Monmouth Beach, NJ — on the Shrewsbury
          River, north of the Highlands–Sea Bright bridge.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          For approach instructions and VHF hailing, see the{" "}
          <Link className="text-navy hover:text-gold" href="/rules#hailing-and-vhf">
            Marina rules
          </Link>
          . For a slip layout, see the{" "}
          <Link className="text-navy hover:text-gold" href="/map">
            marina map
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
