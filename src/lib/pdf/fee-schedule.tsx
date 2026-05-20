/* eslint-disable @next/next/no-img-element */
// React-PDF renderer for the board-ready fee schedule export.
//
// Used by:
//   GET /api/exports/scenario/[id].pdf — emits this PDF as the response body.
//
// Constraints:
//   • Must look reasonable when printed.
//   • Watermarks with "DRAFT — not yet board-approved" when state=draft.
//   • Includes everything Linda would want to email to the board: rates,
//     multipliers, amenity/buy-in rules, projected revenue, top 5
//     winners/losers, approval signature block.
//
// Charts are intentionally simple text tables for v1 — react-pdf does not
// have first-class chart primitives, and the spec says "PDF gets a basic
// table". Add chart visuals in a follow-up.

import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  feeBaseConfigSchema,
  scenarioSeasonOverridesSchema,
  type FeeBaseConfig,
} from "@/lib/zod/schemas";
import { loadProjectionAssignments } from "@/lib/modeler/assignments";
import {
  projectScenario,
  compareScenarios,
  type CompareResult,
  type ProjectionResult,
} from "@/lib/modeler/projection";
import type { FeeSchedule as PricingFeeSchedule } from "@/lib/pricing/resolve";

/* ============================================================
 * Brand colors — match tailwind.config.ts.
 * ============================================================ */
const NAVY = "#1a3a5c";
const NAVY_LIGHT = "#d9e2ec";
const GOLD = "#c9a227";
const SLATE = "#475569";
const RED = "#b91c1c";
const GREEN = "#15803d";

/* ============================================================
 * Styles
 * ============================================================ */
const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    borderBottomStyle: "solid",
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    color: NAVY,
  },
  subtitle: {
    fontSize: 11,
    color: SLATE,
    marginTop: 4,
  },
  watermark: {
    position: "absolute",
    top: 320,
    left: 90,
    fontSize: 60,
    color: GOLD,
    opacity: 0.18,
    transform: "rotate(-25deg)",
    fontWeight: 700,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: NAVY,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: { flexDirection: "row" },
  cell: {
    padding: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: NAVY_LIGHT,
    borderBottomStyle: "solid",
  },
  th: {
    fontWeight: 700,
    backgroundColor: NAVY_LIGHT,
    color: NAVY,
  },
  topline: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: NAVY_LIGHT,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: GOLD,
    borderLeftStyle: "solid",
  },
  toplineLabel: { fontSize: 10, color: SLATE },
  toplineValue: { fontSize: 18, fontWeight: 700, color: NAVY },
  deltaGreen: { color: GREEN, fontWeight: 700 },
  deltaRed: { color: RED, fontWeight: 700 },
  signatureBlock: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: NAVY,
    borderTopStyle: "solid",
  },
  sigLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  sigSlot: {
    width: "32%",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    paddingBottom: 24,
  },
  sigLabel: { fontSize: 9, color: SLATE, marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 8,
    color: SLATE,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

/* ============================================================
 * Public API
 * ============================================================ */

export interface FeeSchedulePDFInput {
  feeScheduleId: number | bigint;
  /** Optional scenario id — when present, includes the per-holder summary. */
  scenarioId?: number | bigint;
}

export async function generateFeeSchedulePDF(
  input: FeeSchedulePDFInput,
): Promise<Buffer> {
  const data = await loadPdfData(input);
  const doc = <FeeSchedulePDFDocument data={data} />;
  return await renderToBuffer(doc);
}

/* ============================================================
 * Data loader
 * ============================================================ */

interface PdfData {
  scheduleName: string;
  state: string;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  approvalReference: string | null;
  baseConfig: FeeBaseConfig;
  projection: ProjectionResult;
  compareVsActive?: CompareResult;
  scenarioName?: string;
  scenarioStatus?: string;
  generatedAt: Date;
}

async function loadPdfData(input: FeeSchedulePDFInput): Promise<PdfData> {
  const [schedRow] = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.id, BigInt(input.feeScheduleId)))
    .limit(1);
  if (!schedRow) throw new Error(`Fee schedule ${input.feeScheduleId} not found`);

  const baseConfig = feeBaseConfigSchema.parse(schedRow.baseConfig);

  let scenarioName: string | undefined;
  let scenarioStatus: string | undefined;
  let overrides: ReturnType<typeof scenarioSeasonOverridesSchema.parse> | undefined;
  if (input.scenarioId) {
    const [scnRow] = await db
      .select()
      .from(schema.scenario)
      .where(eq(schema.scenario.id, BigInt(input.scenarioId)))
      .limit(1);
    if (scnRow) {
      scenarioName = scnRow.name;
      scenarioStatus = scnRow.status;
      overrides = scnRow.seasonOverrides
        ? scenarioSeasonOverridesSchema.parse(scnRow.seasonOverrides)
        : undefined;
    }
  }

  const seasonYear = overrides?.seasonStartDate
    ? Number(overrides.seasonStartDate.slice(0, 4))
    : 2027;

  const assignments = await loadProjectionAssignments(seasonYear);
  const projection = projectScenario({
    feeSchedule: baseConfig as unknown as PricingFeeSchedule,
    assignments,
    occupancy: overrides?.occupancyAssumptions,
    seasonYear,
  });

  // Best-effort: compare to current Active for the delta callout.
  let compareVsActive: CompareResult | undefined;
  const [activeRow] = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.state, "active"))
    .limit(1);
  if (activeRow && activeRow.id !== schedRow.id) {
    try {
      const activeBaseConfig = feeBaseConfigSchema.parse(activeRow.baseConfig);
      const activeProjection = projectScenario({
        feeSchedule: activeBaseConfig as unknown as PricingFeeSchedule,
        assignments,
        seasonYear,
      });
      compareVsActive = compareScenarios(activeProjection, projection, { topN: 5 });
    } catch {
      // Drift in the Active config — skip comparison rather than failing the PDF.
    }
  }

  return {
    scheduleName: schedRow.name,
    state: schedRow.state,
    effectiveStart: schedRow.effectiveStart ?? null,
    effectiveEnd: schedRow.effectiveEnd ?? null,
    approvalReference: schedRow.approvalReference ?? null,
    baseConfig,
    projection,
    compareVsActive,
    scenarioName,
    scenarioStatus,
    generatedAt: new Date(),
  };
}

/* ============================================================
 * The actual document
 * ============================================================ */

function FeeSchedulePDFDocument({ data }: { data: PdfData }) {
  const isDraft = data.state === "draft";
  const isSubmitted = data.state === "submitted";
  const fmt = currencyFormatter();

  return (
    <Document
      title={data.scenarioName ?? data.scheduleName}
      author="Wharfside Marina"
      subject="Fee Schedule"
    >
      <Page size="LETTER" style={styles.page}>
        {isDraft ? <Text style={styles.watermark}>DRAFT</Text> : null}
        {isSubmitted ? <Text style={styles.watermark}>SUBMITTED</Text> : null}

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Wharfside Marina</Text>
            <Text style={styles.subtitle}>
              FY27 Proposed Fee Schedule
              {data.scenarioName ? ` — ${data.scenarioName}` : ""}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, color: SLATE }}>
              {data.generatedAt.toISOString().slice(0, 10)}
            </Text>
            <Text style={{ fontSize: 9, color: SLATE, textAlign: "right" }}>
              State: {data.state.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Topline */}
        <View style={styles.topline}>
          <View>
            <Text style={styles.toplineLabel}>Projected revenue</Text>
            <Text style={styles.toplineValue}>{fmt(data.projection.total)}</Text>
          </View>
          {data.compareVsActive ? (
            <View>
              <Text style={styles.toplineLabel}>vs. current Active</Text>
              <Text
                style={
                  data.compareVsActive.delta >= 0
                    ? styles.deltaGreen
                    : styles.deltaRed
                }
              >
                {data.compareVsActive.delta >= 0 ? "+" : "−"}
                {fmt(Math.abs(data.compareVsActive.delta))} (
                {data.compareVsActive.deltaPct.toFixed(1)}%)
              </Text>
            </View>
          ) : null}
        </View>

        {/* Rate matrix */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Base Rates by Tier ($/year)</Text>
          <View style={styles.row}>
            <View style={[styles.cell, styles.th, { width: "25%" }]}>
              <Text>Tier</Text>
            </View>
            <View style={[styles.cell, styles.th, { width: "25%", textAlign: "right" }]}>
              <Text>Full Season</Text>
            </View>
            <View style={[styles.cell, styles.th, { width: "25%", textAlign: "right" }]}>
              <Text>Half-1</Text>
            </View>
            <View style={[styles.cell, styles.th, { width: "25%", textAlign: "right" }]}>
              <Text>Half-2</Text>
            </View>
          </View>
          {(["Premium", "Standard", "Restricted"] as const).map((tier) => {
            const annual = data.baseConfig.base_rates_by_tier[tier].annual;
            const m = data.baseConfig.lease_type_multipliers;
            return (
              <View key={tier} style={styles.row}>
                <View style={[styles.cell, { width: "25%" }]}>
                  <Text>{tier}</Text>
                </View>
                <View style={[styles.cell, { width: "25%", textAlign: "right" }]}>
                  <Text>{fmt(annual * m.FULL_SEASON)}</Text>
                </View>
                <View style={[styles.cell, { width: "25%", textAlign: "right" }]}>
                  <Text>{fmt(annual * m.HALF_SEASON_1)}</Text>
                </View>
                <View style={[styles.cell, { width: "25%", textAlign: "right" }]}>
                  <Text>{fmt(annual * m.HALF_SEASON_2)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Multipliers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Holder Multipliers</Text>
          <View style={styles.row}>
            <View style={[styles.cell, styles.th, { width: "60%" }]}>
              <Text>Bucket</Text>
            </View>
            <View style={[styles.cell, styles.th, { width: "40%", textAlign: "right" }]}>
              <Text>Multiplier</Text>
            </View>
          </View>
          {Object.entries(data.baseConfig.holder_multipliers).map(([k, v]) => (
            <View key={k} style={styles.row}>
              <View style={[styles.cell, { width: "60%" }]}>
                <Text>{k}</Text>
              </View>
              <View style={[styles.cell, { width: "40%", textAlign: "right" }]}>
                <Text>{Number(v).toFixed(2)}×</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Amenity / Buy-in / Transient */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenity, Buy-In & Transient</Text>
          <KVRow label="Amenity fee (annual)" value={fmt(data.baseConfig.amenity_fee.annual)} />
          <KVRow
            label="Amenity waived for residents"
            value={data.baseConfig.amenity_fee.waived_for_resident ? "Yes" : "No"}
          />
          <KVRow
            label="Amenity half-season proration"
            value={`${(data.baseConfig.amenity_fee.half_season_proration ?? 1).toFixed(2)}×`}
          />
          <KVRow label="Buy-in amount" value={fmt(data.baseConfig.buy_in.amount)} />
          <KVRow
            label="Buy-in applies to"
            value={data.baseConfig.buy_in.applies_to.join(", ") || "—"}
          />
          <KVRow
            label="Transient per-foot per-night"
            value={`${fmt(data.baseConfig.transient_per_foot_per_night)} /ft/night`}
          />
        </View>

        {/* Top winners / losers */}
        {data.compareVsActive ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top 5 Holder Impacts</Text>
            <Text style={{ fontSize: 9, color: SLATE, marginBottom: 4 }}>
              Largest fee changes vs. current Active schedule.
            </Text>
            <View style={styles.row}>
              <View style={[styles.cell, styles.th, { width: "40%" }]}>
                <Text>Holder</Text>
              </View>
              <View style={[styles.cell, styles.th, { width: "15%" }]}>
                <Text>Slip</Text>
              </View>
              <View style={[styles.cell, styles.th, { width: "15%", textAlign: "right" }]}>
                <Text>Active</Text>
              </View>
              <View style={[styles.cell, styles.th, { width: "15%", textAlign: "right" }]}>
                <Text>New</Text>
              </View>
              <View style={[styles.cell, styles.th, { width: "15%", textAlign: "right" }]}>
                <Text>Δ</Text>
              </View>
            </View>
            {[...data.compareVsActive.topLosers, ...data.compareVsActive.topWinners].map(
              (d) => (
                <View key={d.holderId} style={styles.row}>
                  <View style={[styles.cell, { width: "40%" }]}>
                    <Text>{d.holderName}</Text>
                  </View>
                  <View style={[styles.cell, { width: "15%" }]}>
                    <Text>{d.slipNumber}</Text>
                  </View>
                  <View style={[styles.cell, { width: "15%", textAlign: "right" }]}>
                    <Text>{fmt(d.baselineFee)}</Text>
                  </View>
                  <View style={[styles.cell, { width: "15%", textAlign: "right" }]}>
                    <Text>{fmt(d.scenarioFee)}</Text>
                  </View>
                  <View
                    style={[
                      styles.cell,
                      { width: "15%", textAlign: "right" },
                    ]}
                  >
                    <Text style={d.delta >= 0 ? styles.deltaRed : styles.deltaGreen}>
                      {d.delta >= 0 ? "+" : "−"}
                      {fmt(Math.abs(d.delta))}
                    </Text>
                  </View>
                </View>
              ),
            )}
          </View>
        ) : null}

        {/* Signature block (only for non-draft, but always render space for it) */}
        <View style={styles.signatureBlock}>
          <Text style={styles.sectionTitle}>Board Approval</Text>
          {data.approvalReference ? (
            <Text style={{ fontSize: 9, color: SLATE, marginBottom: 4 }}>
              Reference: {data.approvalReference}
            </Text>
          ) : null}
          <View style={styles.sigLine}>
            <View>
              <View style={styles.sigSlot} />
              <Text style={styles.sigLabel}>Board President</Text>
            </View>
            <View>
              <View style={styles.sigSlot} />
              <Text style={styles.sigLabel}>Treasurer</Text>
            </View>
            <View>
              <View style={styles.sigSlot} />
              <Text style={styles.sigLabel}>Date</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Wharfside Marina · Generated {data.generatedAt.toISOString().slice(0, 10)}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.cell, { width: "60%" }]}>
        <Text>{label}</Text>
      </View>
      <View style={[styles.cell, { width: "40%", textAlign: "right" }]}>
        <Text>{value}</Text>
      </View>
    </View>
  );
}

function currencyFormatter() {
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return (n: number) => fmt.format(n);
}

// Suppress react-pdf Font.register warning by registering Helvetica as available.
// react-pdf ships Helvetica by default — this is a no-op but documents intent.
Font.registerHyphenationCallback((word: string) => [word]);
