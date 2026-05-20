import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";

export const metadata: Metadata = {
  title: "Emergency procedures",
  description:
    "Fire, medical, U.S. Coast Guard, and storm-prep procedures for Wharfside Marina. After-hours marina emergencies: 732-970-6886.",
};

const NUMBERS: Array<{ label: string; number: string; tel: string; note?: string }> = [
  { label: "Life-threatening emergency", number: "911", tel: "+1911", note: "Police, fire, EMS" },
  { label: "After-hours marina emergency", number: "732-970-6886", tel: "+17329706886" },
  { label: "ECI office (business hours)", number: "732-751-1991", tel: "+17327511991" },
  { label: "U.S. Coast Guard — Sandy Hook", number: "732-872-3414", tel: "+17328723414" },
  { label: "USCG National Response Center (spills)", number: "1-800-424-8802", tel: "+18004248802" },
];

const PROCEDURES = [
  {
    id: "fire",
    title: "Fire on a vessel or pier",
    steps: [
      "Dial 911. State “fire on a boat at Wharfside Marina, Monmouth Beach.”",
      "Sound a continuous five-blast horn signal to alert neighboring vessels.",
      "If safe, disconnect the affected vessel's shore power at the pedestal.",
      "Use the nearest dock fire extinguisher. Do not re-enter a burning cabin.",
      "Call the after-hours marina line (732-970-6886) once 911 is on the way.",
    ],
  },
  {
    id: "medical",
    title: "Medical emergency",
    steps: [
      "Dial 911. Give the marina address and your slip number.",
      "If possible, send a second person to the gate to flag down the ambulance.",
      "If the casualty is on the water, request Coast Guard support via VHF 16.",
      "Notify the dockmaster (after-hours line) so we can clear access for EMS.",
    ],
  },
  {
    id: "uscg",
    title: "On-water distress — U.S. Coast Guard",
    steps: [
      "Use VHF channel 16. Begin with “Mayday, Mayday, Mayday” for life-threatening; “Pan-Pan” for urgent but non-life-threatening.",
      "Give vessel name, position (lat/lon or landmark), nature of distress, number of persons aboard, and any injuries.",
      "Keep transmitting and listen for response — do not leave the radio.",
      "If at the dock, you may also call USCG Sandy Hook directly.",
    ],
  },
  {
    id: "spill",
    title: "Fuel, oil, or sewage spill",
    steps: [
      "Stop the source. Contain with absorbent pads if available.",
      "Call the U.S. Coast Guard National Response Center at 1-800-424-8802 — federally required for any oil or hazardous-substance spill on navigable waters.",
      "Notify the dockmaster immediately.",
      "Do not use detergents or dispersants — they make the spill worse and are illegal.",
    ],
  },
  {
    id: "storm",
    title: "Storm preparation",
    steps: [
      "Watch NOAA forecasts and follow the dockmaster's pre-storm bulletins.",
      "Double all lines and add chafe protection at every chock and cleat.",
      "Remove canvas (bimini, dodger, cockpit covers) and loose deck gear.",
      "Charge batteries; close seacocks not in use; check bilge pump operation.",
      "Do not stay aboard during a named storm.",
    ],
  },
];

export default function EmergencyPage() {
  return (
    <article>
      <PageHeader
        eyebrow="If in doubt — dial 911"
        title="Emergency procedures"
        lede="Marina-specific procedures for fire, medical, on-water distress, spills, and storms. Save the after-hours marina line in your phone now."
      />

      <section
        aria-labelledby="numbers"
        className="mt-8 rounded-xl border border-danger bg-white p-6 sm:p-8"
      >
        <h2 id="numbers" className="text-2xl font-semibold">
          Emergency numbers
        </h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {NUMBERS.map((n) => (
            <li
              key={n.number}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{n.label}</p>
                {n.note && <p className="text-sm text-slate-500">{n.note}</p>}
              </div>
              <a
                href={`tel:${n.tel}`}
                className="font-serif text-xl font-semibold text-navy hover:text-gold"
              >
                {n.number}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {PROCEDURES.map((p) => (
        <section
          key={p.id}
          id={p.id}
          aria-labelledby={`${p.id}-heading`}
          className="mt-10 scroll-mt-20"
        >
          <h2 id={`${p.id}-heading`} className="text-2xl font-semibold">
            {p.title}
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-7 text-slate-900">
            {p.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      ))}
    </article>
  );
}
