// /admin/modeler/scenarios/new — create a new scenario.
//
// Server component with a server-action form. By default we pre-select
// the current Active fee schedule as the base; an admin can change it
// via the dropdown.

import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/helpers";
import { createScenario } from "@/app/admin/modeler/actions";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui/primitives";

export default async function NewScenarioPage() {
  await requireRole("board", "eci_admin", "super_admin");

  const schedules = await db
    .select({
      id: schema.feeSchedule.id,
      name: schema.feeSchedule.name,
      state: schema.feeSchedule.state,
    })
    .from(schema.feeSchedule)
    .orderBy(desc(schema.feeSchedule.updatedAt));

  // Prefer Active as the default. If none, fall back to most recent.
  const defaultId =
    schedules.find((s) => s.state === "active")?.id ?? schedules[0]?.id;

  async function submit(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const baseFeeScheduleId = String(formData.get("baseFeeScheduleId") ?? "");
    const notes = String(formData.get("notes") ?? "");
    if (!name || !baseFeeScheduleId) {
      throw new Error("Name and base fee schedule are required");
    }
    const { scenarioId } = await createScenario({
      name,
      baseFeeScheduleId,
      notes: notes || undefined,
    });
    redirect(`/admin/modeler/scenarios/${scenarioId}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-navy-900">New scenario</h1>
      <p className="mt-1 text-sm text-slate-600">
        A new scenario is created in <strong>Draft</strong>. Its rates are cloned
        from the schedule you pick below; edits don’t affect the source.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Scenario name</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={160}
                placeholder="FY27 — 5% bump + non-resident amenity fee"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="baseFeeScheduleId">Clone rates from</Label>
              <select
                id="baseFeeScheduleId"
                name="baseFeeScheduleId"
                required
                defaultValue={defaultId ? String(defaultId) : ""}
                className="h-9 w-full rounded-md border border-navy-100 bg-white px-3 text-sm"
              >
                {schedules.length === 0 ? (
                  <option value="" disabled>
                    (No fee schedules exist yet — seed one first)
                  </option>
                ) : null}
                {schedules.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {s.name} — {s.state}
                    {s.state === "active" ? " ★" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Defaults to the current Active schedule.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                name="notes"
                maxLength={2000}
                rows={3}
                className="w-full rounded-md border border-navy-100 bg-white p-3 text-sm"
                placeholder="What hypothesis is this scenario testing?"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="submit">Create scenario</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
