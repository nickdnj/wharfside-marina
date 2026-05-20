"use client";

// Visual stepper for the fee_schedule state machine:
//   Draft → Submitted → Approved → Active → Archived
//
// Renders all five states; highlights the current state in gold; renders
// completed states in navy; future states muted. Used in the scenario
// editor header and in the schedule detail view.

import * as React from "react";

type State = "draft" | "submitted" | "approved" | "active" | "archived";

const FLOW: readonly State[] = [
  "draft",
  "submitted",
  "approved",
  "active",
  "archived",
] as const;

const LABELS: Record<State, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  active: "Active",
  archived: "Archived",
};

export function FeeScheduleStateMachine({ current }: { current: State }) {
  const currentIdx = FLOW.indexOf(current);

  return (
    <ol className="flex items-center gap-1 text-xs font-medium" aria-label="Fee schedule state">
      {FLOW.map((s, i) => {
        const isCurrent = s === current;
        const isPast = i < currentIdx;
        const isFuture = i > currentIdx;
        return (
          <li key={s} className="flex items-center gap-1">
            <span
              className={`flex h-6 items-center rounded-full px-2 ${
                isCurrent
                  ? "bg-gold-500 text-white"
                  : isPast
                    ? "bg-navy-500 text-white"
                    : "bg-slate-100 text-slate-500"
              }`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {LABELS[s]}
            </span>
            {i < FLOW.length - 1 ? (
              <span
                className={isFuture ? "text-slate-300" : "text-navy-500"}
                aria-hidden="true"
              >
                →
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
