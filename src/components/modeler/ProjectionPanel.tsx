"use client";

// Right-pane projection display. Pure presentational — receives the
// ProjectionResult + optional CompareResult and renders:
//   • Topline projected revenue (large)
//   • Delta vs. baseline (colored arrow)
//   • Breakdown bars (by tier / holder state / lease type)
//   • Skipped-assignment notice when resolveFee threw on some rows
//
// Bars are CSS-only (no chart library) to keep the bundle small. The PDF
// reuses the same data shape via a table.

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import type {
  CompareResult,
  ProjectionResult,
} from "@/lib/modeler/projection";

export interface ProjectionPanelProps {
  projection: ProjectionResult | null;
  compare?: CompareResult | null;
  isStale?: boolean;
}

export function ProjectionPanel({
  projection,
  compare,
  isStale = false,
}: ProjectionPanelProps) {
  if (!projection) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500">
            Saving will compute the projection. Drag a rate or edit a
            multiplier to see live numbers.
          </p>
        </CardContent>
      </Card>
    );
  }

  const fmt = currencyFormatter();

  return (
    <div className="space-y-4">
      {/* Topline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Projected revenue
            {isStale ? (
              <span className="text-xs font-normal text-slate-500">
                (recalculating…)
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-3xl text-navy-900 transition-opacity">
            {fmt(projection.total)}
          </p>
          {compare ? (
            <p
              className={`mt-1 text-sm font-medium ${
                compare.delta >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {compare.delta >= 0 ? "▲" : "▼"} {fmt(Math.abs(compare.delta))}{" "}
              <span className="opacity-70">
                ({compare.deltaPct >= 0 ? "+" : ""}
                {compare.deltaPct.toFixed(2)}%) vs. baseline
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              No baseline selected — set a comparison to see delta.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Breakdowns */}
      <Card>
        <CardHeader>
          <CardTitle>By Slip Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <BarBreakdown data={projection.byTier} fmt={fmt} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By Holder State</CardTitle>
        </CardHeader>
        <CardContent>
          <BarBreakdown data={projection.byHolderState} fmt={fmt} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By Lease Type</CardTitle>
        </CardHeader>
        <CardContent>
          <BarBreakdown data={projection.byLeaseType} fmt={fmt} />
        </CardContent>
      </Card>

      {/* Winners / losers */}
      {compare ? (
        <Card>
          <CardHeader>
            <CardTitle>Top Impact (vs. baseline)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ImpactList
              title="Top 10 winners"
              rows={compare.topWinners}
              tone="green"
              fmt={fmt}
            />
            <ImpactList
              title="Top 10 losers"
              rows={compare.topLosers}
              tone="red"
              fmt={fmt}
            />
          </CardContent>
        </Card>
      ) : null}

      {projection.skippedCount > 0 ? (
        <Card>
          <CardContent>
            <p className="text-xs text-amber-700">
              {projection.skippedCount} assignment(s) skipped during projection
              (e.g., transient without vessel LOA). Check the holders page for
              details.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/* ============================================================
 * Sub-components
 * ============================================================ */

function BarBreakdown({
  data,
  fmt,
}: {
  data: Record<string, number>;
  fmt: (n: number) => string;
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No revenue yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => {
        const pct = total === 0 ? 0 : (v / total) * 100;
        return (
          <li key={k}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{k}</span>
              <span className="font-mono text-navy-900">{fmt(v)}</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-navy-500"
                style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                aria-label={`${pct.toFixed(1)}%`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ImpactList({
  title,
  rows,
  tone,
  fmt,
}: {
  title: string;
  rows: ReadonlyArray<{
    holderName: string;
    slipNumber: string;
    delta: number;
  }>;
  tone: "green" | "red";
  fmt: (n: number) => string;
}) {
  const cls = tone === "green" ? "text-green-700" : "text-red-700";
  return (
    <div>
      <h4 className="text-sm font-semibold text-navy-900">{title}</h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No holders in this group.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((r) => (
            <li
              key={`${r.holderName}-${r.slipNumber}`}
              className="flex justify-between text-xs"
            >
              <span className="truncate">
                {r.holderName} <span className="text-slate-400">· {r.slipNumber}</span>
              </span>
              <span className={`font-mono ${cls}`}>
                {r.delta >= 0 ? "+" : "−"}
                {fmt(Math.abs(r.delta))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function currencyFormatter() {
  const f = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return (n: number) => f.format(n);
}
