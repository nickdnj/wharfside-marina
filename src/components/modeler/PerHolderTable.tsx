"use client";

// Sortable per-holder impact table — used by:
//   • /admin/modeler/scenarios/[id]/holders/page.tsx (full table)
//   • /admin/modeler/scenarios/[id]/compare/page.tsx (delta column)
//
// Sort is client-side (we never have more than ~86 holders); search/filter
// is a controlled input on `holderName + slipNumber`.

import * as React from "react";
import { Card, CardContent, Input } from "@/components/ui/primitives";

export interface PerHolderRow {
  holderId: string;
  holderName: string;
  slipNumber: string;
  currentFee?: number;
  scenarioFee: number;
  delta?: number;
  deltaPct?: number;
}

export interface PerHolderTableProps {
  rows: ReadonlyArray<PerHolderRow>;
  /** Render the current-fee / delta columns? */
  showDelta?: boolean;
}

type SortKey =
  | "holderName"
  | "slipNumber"
  | "currentFee"
  | "scenarioFee"
  | "delta"
  | "deltaPct";
type SortDir = "asc" | "desc";

export function PerHolderTable({ rows, showDelta = true }: PerHolderTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("delta");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.holderName.toLowerCase().includes(q) ||
        r.slipNumber.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = React.useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const av = (a[sortKey] ?? 0) as number | string;
      const bv = (b[sortKey] ?? 0) as number | string;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  function clickHeader(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const fmt = currencyFormatter();

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center gap-3">
          <Input
            type="search"
            placeholder="Filter by name or slip…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
            aria-label="Filter holders"
          />
          <span className="text-xs text-slate-500">
            {sorted.length} of {rows.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <Th sortKey="holderName" current={sortKey} dir={sortDir} onClick={clickHeader}>
                  Holder
                </Th>
                <Th sortKey="slipNumber" current={sortKey} dir={sortDir} onClick={clickHeader}>
                  Slip
                </Th>
                {showDelta ? (
                  <Th
                    sortKey="currentFee"
                    current={sortKey}
                    dir={sortDir}
                    onClick={clickHeader}
                    align="right"
                  >
                    Current
                  </Th>
                ) : null}
                <Th
                  sortKey="scenarioFee"
                  current={sortKey}
                  dir={sortDir}
                  onClick={clickHeader}
                  align="right"
                >
                  Scenario
                </Th>
                {showDelta ? (
                  <>
                    <Th
                      sortKey="delta"
                      current={sortKey}
                      dir={sortDir}
                      onClick={clickHeader}
                      align="right"
                    >
                      Δ $
                    </Th>
                    <Th
                      sortKey="deltaPct"
                      current={sortKey}
                      dir={sortDir}
                      onClick={clickHeader}
                      align="right"
                    >
                      Δ %
                    </Th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const positive = (r.delta ?? 0) > 0;
                const negative = (r.delta ?? 0) < 0;
                return (
                  <tr key={r.holderId + r.slipNumber} className="border-b border-navy-50">
                    <td className="py-2 text-navy-900">{r.holderName}</td>
                    <td className="py-2 text-slate-700">{r.slipNumber}</td>
                    {showDelta ? (
                      <td className="py-2 text-right font-mono">
                        {r.currentFee == null ? "—" : fmt(r.currentFee)}
                      </td>
                    ) : null}
                    <td className="py-2 text-right font-mono">{fmt(r.scenarioFee)}</td>
                    {showDelta ? (
                      <>
                        <td
                          className={`py-2 text-right font-mono ${
                            positive ? "text-red-700" : negative ? "text-green-700" : ""
                          }`}
                        >
                          {r.delta == null
                            ? "—"
                            : `${r.delta >= 0 ? "+" : "−"}${fmt(Math.abs(r.delta))}`}
                        </td>
                        <td
                          className={`py-2 text-right font-mono ${
                            positive ? "text-red-700" : negative ? "text-green-700" : ""
                          }`}
                        >
                          {r.deltaPct == null
                            ? "—"
                            : `${(r.deltaPct ?? 0).toFixed(2)}%`}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Th({
  children,
  sortKey,
  current,
  dir,
  onClick,
  align = "left",
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === current;
  return (
    <th
      scope="col"
      className={`cursor-pointer select-none px-2 py-2 ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-navy-900" : ""}`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? <span aria-hidden>{dir === "asc" ? "▲" : "▼"}</span> : null}
      </span>
    </th>
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
