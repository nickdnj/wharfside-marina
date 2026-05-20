// State-machine guards for fee_schedule and scenario.
//
// The legal transition graphs are encoded as constants here so we can
// unit-test them in isolation. Server actions call `assertFeeScheduleTransition`
// or `assertScenarioTransition` BEFORE mutating the row; an illegal transition
// throws `ScenarioError("INVALID_TRANSITION")` and nothing is written.
//
// Why two state machines?
//   • `fee_schedule.state` (Draft → Submitted → Approved → Active → Archived)
//     drives the actual billing — only one row can be Active at a time
//     (enforced by the `one_active_schedule` partial-unique index).
//   • `scenario.status` (draft → under_review → submitted → approved_superseded
//     → archived) tracks the *workflow* around a hypothetical, decoupled
//     from whether the underlying fee_schedule has been promoted to Active.
//
// Both share the same approach: build an adjacency set, ask the set, throw on no.

import { ScenarioError } from "./errors";
import type { FeeScheduleState, ScenarioStatus } from "@/lib/zod/schemas";

/* ============================================================
 * Fee schedule transitions — Architecture §7, PRD §3.6.4
 * ============================================================ */

const FEE_SCHEDULE_TRANSITIONS: Record<FeeScheduleState, ReadonlySet<FeeScheduleState>> = {
  draft: new Set(["submitted", "archived"]),
  submitted: new Set(["approved", "archived"]),
  approved: new Set(["active", "archived"]),
  active: new Set(["archived"]), // archival on supersede
  archived: new Set(), // terminal
};

export function isLegalFeeScheduleTransition(
  from: FeeScheduleState,
  to: FeeScheduleState,
): boolean {
  return FEE_SCHEDULE_TRANSITIONS[from].has(to);
}

export function assertFeeScheduleTransition(
  from: FeeScheduleState,
  to: FeeScheduleState,
): void {
  if (!isLegalFeeScheduleTransition(from, to)) {
    throw new ScenarioError(
      "INVALID_TRANSITION",
      `Illegal fee_schedule transition: '${from}' → '${to}'`,
      { from, to, allowed: Array.from(FEE_SCHEDULE_TRANSITIONS[from]) },
    );
  }
}

/* ============================================================
 * Scenario transitions — workflow around a hypothetical
 * ============================================================ */

const SCENARIO_TRANSITIONS: Record<ScenarioStatus, ReadonlySet<ScenarioStatus>> = {
  draft: new Set(["under_review", "archived"]),
  under_review: new Set(["submitted", "draft", "archived"]),
  submitted: new Set(["approved_superseded", "archived"]),
  approved_superseded: new Set(["archived"]),
  archived: new Set(), // terminal
};

export function isLegalScenarioTransition(
  from: ScenarioStatus,
  to: ScenarioStatus,
): boolean {
  return SCENARIO_TRANSITIONS[from].has(to);
}

export function assertScenarioTransition(
  from: ScenarioStatus,
  to: ScenarioStatus,
): void {
  if (!isLegalScenarioTransition(from, to)) {
    throw new ScenarioError(
      "INVALID_TRANSITION",
      `Illegal scenario transition: '${from}' → '${to}'`,
      { from, to, allowed: Array.from(SCENARIO_TRANSITIONS[from]) },
    );
  }
}

/* ============================================================
 * "Is this state editable?" — used by UI + server-side write guard.
 * ============================================================ */

export function isFeeScheduleEditable(state: FeeScheduleState): boolean {
  return state === "draft";
}

export function isScenarioEditable(status: ScenarioStatus): boolean {
  return status === "draft" || status === "under_review";
}

/* ============================================================
 * Exposed for visual progress component + tests.
 * ============================================================ */

export const FEE_SCHEDULE_FLOW: readonly FeeScheduleState[] = [
  "draft",
  "submitted",
  "approved",
  "active",
  "archived",
] as const;

export const SCENARIO_FLOW: readonly ScenarioStatus[] = [
  "draft",
  "under_review",
  "submitted",
  "approved_superseded",
  "archived",
] as const;
