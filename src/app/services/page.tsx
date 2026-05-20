import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";

export const metadata: Metadata = {
  title: "Local services",
  description:
    "Fuel, pump-out, ice, repairs, provisioning, and restaurants near Wharfside Marina in Monmouth Beach and Sea Bright, NJ.",
};

type Service = {
  name: string;
  town: string;
  notes?: string;
};

type Category = {
  id: string;
  title: string;
  description?: string;
  items: Service[];
};

const CATEGORIES: Category[] = [
  {
    id: "fuel",
    title: "Fuel",
    description:
      "Wharfside does not operate a fuel dock. Nearest options on the Shrewsbury River:",
    items: [
      { name: "Bahrs Landing fuel dock", town: "Highlands", notes: "Gas + diesel; check seasonal hours by phone." },
      { name: "Atlantic Highlands Municipal Marina", town: "Atlantic Highlands", notes: "Gas + diesel; deeper-draft accessible." },
    ],
  },
  {
    id: "pump-out",
    title: "Pump-out",
    items: [
      { name: "Wharfside Marina (by appointment)", town: "Monmouth Beach", notes: "Contact the dockmaster on VHF 9." },
      { name: "Atlantic Highlands Municipal Marina", town: "Atlantic Highlands" },
    ],
  },
  {
    id: "ice-provisioning",
    title: "Ice & provisioning",
    items: [
      { name: "Monmouth Beach Pharmacy & General Store", town: "Monmouth Beach", notes: "Bagged ice, basic groceries, sundries." },
      { name: "Sickles Market", town: "Little Silver", notes: "Larger provisioning trip; prepared foods and produce." },
      { name: "Delicious Orchards", town: "Colts Neck", notes: "Worth the drive for a full restock." },
    ],
  },
  {
    id: "repairs",
    title: "Repairs & service",
    items: [
      { name: "Hoffman's Marine", town: "Brielle", notes: "Engine, drivetrain, electrical." },
      { name: "Twin Lights Marina Service", town: "Highlands", notes: "Light service and seasonal commissioning." },
    ],
  },
  {
    id: "restaurants",
    title: "Restaurants — walk or short ride",
    items: [
      { name: "Sallee Tee's Grille", town: "Monmouth Beach", notes: "Casual; outdoor seating in season." },
      { name: "Bahrs Landing", town: "Highlands", notes: "Classic Jersey Shore seafood by boat or car." },
      { name: "Donovan's Reef", town: "Sea Bright", notes: "Beach bar atmosphere; summer crowd." },
      { name: "Rooney's Oceanfront", town: "Long Branch", notes: "Sit-down; ocean view." },
    ],
  },
  {
    id: "transportation",
    title: "Transportation",
    items: [
      { name: "Seastreak ferry", town: "Atlantic Highlands → NYC", notes: "Useful for guests; runs year-round with seasonal frequency." },
      { name: "NJ Transit North Jersey Coast Line", town: "Little Silver / Long Branch stations", notes: "Rideshare from the marina; train into NYC." },
    ],
  },
];

export default function ServicesPage() {
  return (
    <article>
      <PageHeader
        eyebrow="Around the marina"
        title="Local services"
        lede="Curated by Wharfside slip-holders. Hours change seasonally — call ahead. Submissions and corrections welcome via the contact page."
      />

      <div className="mt-8 space-y-12">
        {CATEGORIES.map((c) => (
          <section
            key={c.id}
            id={c.id}
            aria-labelledby={`${c.id}-heading`}
            className="scroll-mt-20"
          >
            <h2 id={`${c.id}-heading`} className="text-2xl font-semibold">
              {c.title}
            </h2>
            {c.description && (
              <p className="mt-2 text-base text-slate-500">{c.description}</p>
            )}
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {c.items.map((item) => (
                <li
                  key={item.name}
                  className="rounded-xl border border-slate-100 bg-white p-5"
                >
                  <p className="font-serif text-base font-semibold text-navy">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-xs uppercase tracking-wider text-slate-500">
                    {item.town}
                  </p>
                  {item.notes && (
                    <p className="mt-2 text-sm text-slate-900">{item.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
