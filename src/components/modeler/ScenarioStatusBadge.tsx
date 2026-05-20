"use client";

// Renders the scenario.status enum as a colored pill, per UX §4.1.1:
//   Draft (gray) · Submitted (blue) · Approved (green) · Active (gold) · Archived (slate)
// We also handle the fee_schedule.state set (same colors mapped over).

import * as React from "react";
import { Badge } from "@/components/ui/primitives";

type FeeScheduleState =
  | "draft"
  | "submitted"
  | "approved"
  | "active"
  | "archived";
type ScenarioStatus =
  | "draft"
  | "under_review"
  | "submitted"
  | "approved_superseded"
  | "archived";

type AnyState = FeeScheduleState | ScenarioStatus;

const labels: Record<AnyState, string> = {
  draft: "Draft",
  under_review: "Under review",
  submitted: "Submitted",
  approved: "Approved",
  approved_superseded: "Approved (superseded)",
  active: "Active",
  archived: "Archived",
};

const variants: Record<AnyState, "gray" | "blue" | "green" | "gold" | "slate"> = {
  draft: "gray",
  under_review: "blue",
  submitted: "blue",
  approved: "green",
  approved_superseded: "green",
  active: "gold",
  archived: "slate",
};

export function ScenarioStatusBadge({ status }: { status: AnyState }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
