import Link from "next/link";

type Card = {
  href: string;
  title: string;
  description: string;
};

const CARDS: Card[] = [
  {
    href: "/rules",
    title: "Read the rules",
    description: "WMCA handbook: hailing, VHF, fueling, wakes, and conduct.",
  },
  {
    href: "/map",
    title: "See the marina map",
    description: "Slip layout, depths, fairway, and approach.",
  },
  {
    href: "/transient",
    title: "Request a transient slip",
    description: "Short-stay requests reviewed by the dockmaster.",
  },
  {
    href: "/contact",
    title: "Reach the dockmaster",
    description: "Office hours, after-hours emergencies, and email.",
  },
  {
    href: "/forms",
    title: "Find a form",
    description: "Slip application, indemnification, gate key, and more.",
  },
  {
    href: "/login",
    title: "Slip-owner sign in",
    description: "Magic-link access to documents, fees, and your slip.",
  },
];

export function ActionCards() {
  return (
    <section aria-labelledby="here-to" className="mt-12">
      <h2 id="here-to" className="text-2xl font-semibold">
        I&apos;m here to&hellip;
      </h2>
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="group flex h-full flex-col rounded-xl border border-slate-100 bg-white p-6 transition hover:border-navy hover:bg-sand-100"
            >
              <span className="font-serif text-xl font-semibold text-navy">
                {c.title}
              </span>
              <span className="mt-2 flex-1 text-sm text-slate-500">
                {c.description}
              </span>
              <span
                aria-hidden="true"
                className="mt-4 inline-flex items-center font-medium text-navy"
              >
                <span className="transition group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
