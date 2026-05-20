// /admin/modeler — scenario list / library
//
// Server component. Pulls all scenarios + their underlying fee_schedules
// in one go, groups by status, renders cards.
//
// Filter chips ("My scenarios / All / Active proposals / Archived") are
// implemented via the ?filter= query string so this stays an RSC.

import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/helpers";
import { ScenarioStatusBadge } from "@/components/modeler/ScenarioStatusBadge";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";

type Filter = "all" | "mine" | "active-proposals" | "archived";

export default async function ModelerHomePage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const user = await requireRole("board", "eci_admin", "super_admin");
  const filter: Filter = isFilter(searchParams.filter) ? searchParams.filter : "all";

  // Load all scenarios + paired schedules. Tiny table — no pagination yet.
  const rows = await db
    .select({
      scenario: schema.scenario,
      schedule: schema.feeSchedule,
    })
    .from(schema.scenario)
    .innerJoin(schema.feeSchedule, eq(schema.feeSchedule.id, schema.scenario.feeScheduleId))
    .orderBy(desc(schema.scenario.updatedAt));

  const filtered = rows.filter((r) => {
    if (filter === "mine") return String(r.scenario.createdBy ?? "") === user.id;
    if (filter === "archived") return r.scenario.status === "archived";
    if (filter === "active-proposals")
      return (
        r.scenario.status === "submitted" || r.schedule.state === "submitted"
      );
    return true;
  });

  // Group by scenario.status for display.
  const byStatus = new Map<string, typeof filtered>();
  for (const r of filtered) {
    const key = r.scenario.status;
    const arr = byStatus.get(key) ?? [];
    arr.push(r);
    byStatus.set(key, arr);
  }
  const groupOrder = [
    "draft",
    "under_review",
    "submitted",
    "approved_superseded",
    "archived",
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Pricing Modeler</h1>
          <p className="mt-1 text-sm text-slate-600">
            What-if pricing scenarios. Active billing keeps using the schedule
            in <em>Active</em> state — nothing here affects billing until you
            promote it.
          </p>
        </div>
        <Link href="/admin/modeler/scenarios/new">
          <Button>+ New scenario</Button>
        </Link>
      </header>

      {/* Filter chips */}
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {(
          [
            ["all", "All"],
            ["mine", "My scenarios"],
            ["active-proposals", "Active proposals"],
            ["archived", "Archived"],
          ] as const
        ).map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/modeler?filter=${k}`}
            className={`rounded-full border px-3 py-1 ${
              filter === k
                ? "border-navy-500 bg-navy-500 text-white"
                : "border-navy-100 text-navy-900 hover:bg-navy-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-slate-600">
              No scenarios match this filter. Click <strong>+ New scenario</strong> to
              start one — it clones from the current Active schedule by default.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {groupOrder
        .filter((g) => byStatus.has(g))
        .map((g) => {
          const items = byStatus.get(g) ?? [];
          return (
            <section key={g} className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {g.replace(/_/g, " ")} · {items.length}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ scenario, schedule }) => (
                  <Link
                    key={String(scenario.id)}
                    href={`/admin/modeler/scenarios/${String(scenario.id)}`}
                    className="block"
                  >
                    <Card className="transition hover:border-gold-500 hover:shadow-md">
                      <CardHeader>
                        <CardTitle className="truncate">{scenario.name}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <ScenarioStatusBadge
                            status={scenario.status as
                              | "draft"
                              | "under_review"
                              | "submitted"
                              | "approved_superseded"
                              | "archived"}
                          />
                          <span>
                            Schedule: <strong>{schedule.state}</strong>
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="font-mono text-xl text-navy-900">
                          {scenario.projectedRevenue != null
                            ? formatCurrency(Number(scenario.projectedRevenue))
                            : "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {scenario.computedAt
                            ? `Last computed ${new Date(
                                scenario.computedAt,
                              ).toLocaleString()}`
                            : "Never computed"}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
    </main>
  );
}

function isFilter(s: string | undefined): s is Filter {
  return s === "all" || s === "mine" || s === "active-proposals" || s === "archived";
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
